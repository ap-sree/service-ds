package com.antigravity.servicedashboard.controller;

import com.antigravity.servicedashboard.service.VaultService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;


@RestController
@RequestMapping("/api/vault")
public class VaultController {

    private final VaultService vaultService;

    public VaultController(VaultService vaultService) {
        this.vaultService = vaultService;
    }

    
    @GetMapping("/secret/{*path}")
    public ResponseEntity<?> getSecret(
            @PathVariable String path,
            @RequestParam(required = false) String key) {
        try {
            if (key != null && !key.isEmpty()) {
                
                String value = vaultService.getSecretValue(path, key);
                if (value == null) {
                    Map<String, String> error = new HashMap<>();
                    error.put("error", "Key not found: " + key);
                    return ResponseEntity.status(404).body(error);
                }

                Map<String, String> response = new HashMap<>();
                response.put("key", key);
                response.put("value", value);
                return ResponseEntity.ok(response);
            } else {
                
                Map<String, Object> secret = vaultService.getSecret(path);
                return ResponseEntity.ok(secret);
            }
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.status(500).body(error);
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
}
