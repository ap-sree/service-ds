package com.antigravity.servicedashboard.service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.antigravity.servicedashboard.util.MessageUtils;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class ShellService {

    private static final Logger logger = LoggerFactory.getLogger(ShellService.class);
    private final ObjectMapper objectMapper;

    public ShellService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    // Allowlist of permitted commands
    private static final java.util.Set<String> ALLOWED_COMMANDS = java.util.Set.of(
            "kubectl", "docker", "az", "aws", "gcloud",
            "systemctl", "journalctl", "df", "free", "uptime", "echo", "printf");

    // Characters that must never appear in command arguments to prevent injection
    private static final String DANGEROUS_CHARS = ";|&$><!(){}\\\"'`";

    public List<Map<String, Object>> executeCommand(String command, String cwd) {
        validateCommand(command);
        logger.info("Executing Approved Command: {}", command);
        List<String> outputLines = new ArrayList<>();

        try {
            List<String> cmdParts = parseCommandParts(command);
            ProcessBuilder builder = new ProcessBuilder(cmdParts);

            if (cwd != null && !cwd.isEmpty()) {
                builder.directory(new java.io.File(cwd));
            }

            builder.redirectErrorStream(true);
            Process process = builder.start();

            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    outputLines.add(line);
                }
            }

            boolean finished = process.waitFor(30, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                throw new RuntimeException(MessageUtils.get("error.shell.timeout"));
            }

            if (process.exitValue() != 0) {
                throw new RuntimeException(MessageUtils.get("error.shell.exitcode", process.exitValue()));
            }

            return parseOutput(outputLines);

        } catch (SecurityException e) {
            throw e;
        } catch (Exception e) {
            logger.error("Shell Execution Failed", e);
            throw new RuntimeException(MessageUtils.get("error.shell.execution"), e);
        }
    }

    private void validateCommand(String command) {
        if (command == null || command.isBlank()) {
            throw new SecurityException(MessageUtils.get("error.shell.empty"));
        }

        String baseCommand = command.trim().split("\\s+")[0];
        // Normalize path (e.g. /usr/bin/docker -> docker)
        if (baseCommand.contains("/") || baseCommand.contains("\\")) {
            baseCommand = new java.io.File(baseCommand).getName();
        }

        if (!ALLOWED_COMMANDS.contains(baseCommand.toLowerCase())) {
            throw new SecurityException(MessageUtils.get("error.shell.notallowed", baseCommand));
        }

        for (char c : DANGEROUS_CHARS.toCharArray()) {
            if (command.indexOf(c) >= 0) {
                throw new SecurityException(MessageUtils.get("error.shell.forbiddenchar", String.valueOf(c)));
            }
        }
    }

    private List<String> parseCommandParts(String command) {
        return java.util.Arrays.asList(command.trim().split("\\s+"));
    }

    private List<Map<String, Object>> parseOutput(List<String> lines) {

        String fullOutput = String.join("\n", lines).trim();

        if (fullOutput.isEmpty()) {
            return Collections.emptyList();
        }

        if (fullOutput.startsWith("[") || fullOutput.startsWith("{")) {
            try {
                if (fullOutput.startsWith("[")) {
                    return objectMapper.readValue(fullOutput, new TypeReference<List<Map<String, Object>>>() {
                    });
                } else {
                    Map<String, Object> obj = objectMapper.readValue(fullOutput,
                            new TypeReference<Map<String, Object>>() {
                            });
                    return Collections.singletonList(obj);
                }
            } catch (Exception e) {
                logger.warn("Output looked like JSON but failed to parse. Falling back to text line.");
            }
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (String line : lines) {
            result.add(Collections.singletonMap("output", line));
        }
        return result;
    }
}
