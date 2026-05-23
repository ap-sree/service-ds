package com.antigravity.servicedashboard.service;

import com.antigravity.servicedashboard.exception.ApiConnectionException;
import com.antigravity.servicedashboard.exception.SslCertificateException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ssl.SslBundles;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.http.ResponseEntity;

import com.antigravity.servicedashboard.util.MessageUtils;

import java.net.http.HttpClient;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;

@Service
public class RestClientService {

    private static final Logger logger = LoggerFactory.getLogger(RestClientService.class);

    private volatile RestClient restClient;
    private final ObjectMapper objectMapper;
    private final SslBundles sslBundles;
    private final RestClient.Builder restClientBuilder;

    public RestClientService(RestClient.Builder builder, SslBundles sslBundles, ObjectMapper objectMapper) {
        this.restClientBuilder = builder;
        this.sslBundles = sslBundles;
        this.objectMapper = objectMapper;

        buildClient();

        try {
            this.sslBundles.addBundleUpdateHandler("server", bundle -> {
                logger.info("SSL Bundle 'server' updated. Rebuilding RestClient...");
                buildClient();
            });
        } catch (UnsupportedOperationException | NoSuchMethodError e) {
            logger.warn("Dynamic SSL reload not supported by this SslBundles implementation: {}", e.getMessage());
        }
    }

    private void buildClient() {
        try {
            var bundle = sslBundles.getBundle("server");
            var httpClient = HttpClient.newBuilder()
                    .sslContext(bundle.createSslContext())
                    .build();
            var factory = new JdkClientHttpRequestFactory(httpClient);

            this.restClient = restClientBuilder.clone()
                    .requestFactory(factory)
                    .build();
            logger.info("RestClient built with current SSL context.");
        } catch (Exception e) {
            logger.error("Failed to build RestClient", e);
        }
    }

    public List<Map<String, Object>> fetchData(String url, String method, Map<String, String> headersMap) {
        return fetchData(url, method, headersMap, null);
    }

    public List<Map<String, Object>> fetchData(String url, String method, Map<String, String> headersMap, Object body) {
        ResponseEntity<String> response = fetchResponse(url, method, headersMap, body);
        String jsonBody = response.getBody();
        try {
            if (jsonBody != null && !jsonBody.isEmpty()) {
                if (jsonBody.trim().startsWith("[")) {
                    List<?> rawList = objectMapper.readValue(jsonBody, new TypeReference<List<Object>>() {});
                    List<Map<String, Object>> convertedList = new ArrayList<>();
                    for (Object item : rawList) {
                        if (item instanceof Map) {
                            @SuppressWarnings("unchecked")
                            Map<String, Object> mapItem = (Map<String, Object>) item;
                            convertedList.add(mapItem);
                        } else {
                            Map<String, Object> wrapped = new java.util.HashMap<>();
                            wrapped.put("value", item);
                            wrapped.put("$", item);
                            convertedList.add(wrapped);
                        }
                    }
                    return convertedList;
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
            throw new RuntimeException(MessageUtils.get("error.api.parse"), e);
        }
    }

    public ResponseEntity<String> fetchResponse(String url, String method, Map<String, String> headersMap, Object body) {
        logger.info("Fetching response from URL: {}", url);
        try {
            RestClient.RequestBodySpec request = restClient.method(HttpMethod.valueOf(method.toUpperCase()))
                    .uri(url)
                    .contentType(MediaType.APPLICATION_JSON);

            if (headersMap != null) {
                headersMap.forEach(request::header);
            }

            if (body != null) {
                return request.body(body).retrieve().toEntity(String.class);
            } else {
                return request.retrieve().toEntity(String.class);
            }
        } catch (org.springframework.web.client.ResourceAccessException e) {
            if (e.getCause() instanceof javax.net.ssl.SSLException) {
                logger.error("SSL error connecting to: {}", url, e);
                throw new SslCertificateException(MessageUtils.get("error.api.ssl"), e);
            }
            logger.error("Connection error for URL: {}", url, e);
            throw new ApiConnectionException(MessageUtils.get("error.api.connection", url), e);
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            logger.error("HTTP {} error calling {}: {}", e.getStatusCode(), url, e.getMessage());
            throw new ApiConnectionException(MessageUtils.get("error.api.http", e.getStatusCode(), e.getStatusText()), e);
        } catch (org.springframework.web.client.HttpServerErrorException e) {
            logger.error("Server error {} calling {}: {}", e.getStatusCode(), url, e.getMessage());
            throw new ApiConnectionException(MessageUtils.get("error.api.server", e.getStatusCode()), e);
        } catch (Exception e) {
            logger.error("Unexpected error calling API: {}", url, e);
            throw new RuntimeException(MessageUtils.get("error.api.call", e.getMessage()), e);
        }
    }
}
