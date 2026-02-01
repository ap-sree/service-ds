package com.antigravity.servicedashboard.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.vault.core.VaultKeyValueOperationsSupport.KeyValueBackend;
import org.springframework.vault.core.VaultTemplate;
import org.springframework.vault.support.VaultResponse;

import java.util.Map;


@Service
public class VaultService {

    private static final Logger logger = LoggerFactory.getLogger(VaultService.class);
    private final VaultTemplate vaultTemplate;

    @Value("${spring.cloud.vault.kv.backend:secret}")
    private String kvPath;

    public VaultService(VaultTemplate vaultTemplate) {
        this.vaultTemplate = vaultTemplate;
    }

    
    public Map<String, Object> getSecret(String secretPath) {
        try {
            logger.info("Fetching secret from Vault: path='{}', mount='{}'", secretPath, kvPath);

            
            VaultResponse response = vaultTemplate
                    .opsForKeyValue(kvPath, KeyValueBackend.KV_2)
                    .get(secretPath);

            if (response == null || response.getData() == null) {
                logger.error("Secret not found at path: {}/{}", kvPath, secretPath);
                throw new RuntimeException("Secret not found under " + kvPath + "/" + secretPath);
            }

            logger.debug("Successfully retrieved secret");
            return response.getData();

        } catch (Exception e) {
            logger.error("Failed to retrieve secret from Vault: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to retrieve secret from Vault: " + e.getMessage(), e);
        }
    }

    
    public String getSecretValue(String secretPath, String key) {
        Map<String, Object> secret = getSecret(secretPath);
        Object value = secret.get(key);
        return value != null ? value.toString() : null;
    }

    
    public boolean isHealthy() {
        try {
            vaultTemplate.opsForSys().health();
            return true;
        } catch (Exception e) {
            logger.error("Vault health check failed: {}", e.getMessage());
            return false;
        }
    }
}
