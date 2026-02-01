package com.antigravity.servicedashboard.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.Collections;
import java.util.List;
import java.util.Map;

@Service
public class RestClientService {

    private static final Logger logger = LoggerFactory.getLogger(RestClientService.class);
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public RestClientService(RestTemplateBuilder builder, ObjectMapper objectMapper) {
        this.restTemplate = builder
                .setConnectTimeout(Duration.ofSeconds(10))
                .setReadTimeout(Duration.ofSeconds(30))
                .build();
        this.objectMapper = objectMapper;
    }

    public List<Map<String, Object>> fetchData(String url, String method, Map<String, String> headersMap) {
        logger.info("Fetching data from URL: {}", url);

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            if (headersMap != null) {
                headersMap.forEach(headers::set);
            }

            HttpEntity<String> entity = new HttpEntity<>(headers);
            HttpMethod httpMethod = HttpMethod.valueOf(method.toUpperCase());

            ResponseEntity<String> response = restTemplate.exchange(url, httpMethod, entity, String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                String jsonBody = response.getBody();

                
                if (jsonBody.trim().startsWith("[")) {
                    return objectMapper.readValue(jsonBody, new TypeReference<List<Map<String, Object>>>() {
                    });
                } else {
                    
                    
                    
                    
                    Map<String, Object> singleObj = objectMapper.readValue(jsonBody,
                            new TypeReference<Map<String, Object>>() {
                            });
                    return Collections.singletonList(singleObj);
                }
            } else {
                logger.warn("Request failed. Status: {}", response.getStatusCode());
                return Collections.emptyList();
            }

        } catch (JsonProcessingException e) {
            logger.error("Error parsing JSON response", e);
            throw new RuntimeException("Failed to parse API response", e);
        } catch (Exception e) {
            logger.error("Error calling API", e);
            throw new RuntimeException("API Call Failed: " + e.getMessage(), e);
        }
    }
}
