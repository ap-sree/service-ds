package com.antigravity.servicedashboard.service;

import com.antigravity.servicedashboard.exception.ApiConnectionException;
import com.antigravity.servicedashboard.exception.SslCertificateException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import java.util.Collections;
import java.util.List;
import java.util.Map;

@Service
public class RestClientService {

    private static final Logger logger = LoggerFactory.getLogger(RestClientService.class);

    private final RestClient restClient;

    private final ObjectMapper objectMapper;

    public RestClientService(RestClient.Builder builder, ObjectMapper objectMapper) {
        this.restClient = builder.build();
        this.objectMapper = objectMapper;
    }

    public List<Map<String, Object>> fetchData(String url, String method, Map<String, String> headersMap) {
        return fetchData(url, method, headersMap, null);
    }

    public List<Map<String, Object>> fetchData(String url, String method, Map<String, String> headersMap, Object body) {
        logger.info("Fetching data from URL: {}", url);
        try {
            // Build request
            RestClient.RequestBodySpec request = restClient.method(HttpMethod.valueOf(method.toUpperCase()))
                    .uri(url)
                    .contentType(MediaType.APPLICATION_JSON);

            // Add custom headers
            if (headersMap != null) {
                headersMap.forEach(request::header);
            }

            // Execute request
            String jsonBody;
            if (body != null) {
                jsonBody = request.body(body).retrieve().body(String.class);
            } else {
                jsonBody = request.retrieve().body(String.class);
            }

            if (jsonBody != null && !jsonBody.isEmpty()) {
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
                logger.warn("Request returned empty response");
                return Collections.emptyList();
            }
        } catch (JsonProcessingException e) {
            logger.error("Error parsing JSON response", e);
            throw new RuntimeException("Failed to parse API response", e);
        } catch (org.springframework.web.client.ResourceAccessException e) {
            if (e.getCause() instanceof javax.net.ssl.SSLException) {
                logger.error("SSL error connecting to: {}", url, e);
                throw new SslCertificateException(
                        "SSL Certificate Error: Unable to establish secure connection. Please import the server's certificate into the application truststore.",
                        e);
            }
            logger.error("Connection error for URL: {}", url, e);
            throw new ApiConnectionException(
                    "Connection Error: Unable to reach the server at " + url, e);
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            logger.error("HTTP {} error calling {}: {}", e.getStatusCode(), url, e.getMessage());
            throw new ApiConnectionException(
                    "HTTP Error " + e.getStatusCode() + ": " + e.getStatusText(), e);
        } catch (org.springframework.web.client.HttpServerErrorException e) {
            logger.error("Server error {} calling {}: {}", e.getStatusCode(), url, e.getMessage());
            throw new ApiConnectionException(
                    "Server Error " + e.getStatusCode() + ": The remote server encountered an error", e);
        } catch (Exception e) {
            logger.error("Unexpected error calling API: {}", url, e);
            throw new RuntimeException("API Call Failed: " + e.getMessage(), e);
        }
    }
}
