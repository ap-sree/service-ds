package com.antigravity.servicedashboard.config;

import org.springframework.boot.ssl.SslBundles;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

import java.time.Duration;

@Configuration
public class RestClientConfig {

    @Bean
    public RestClient.Builder restClientBuilder(SslBundles sslBundles) {
        return RestClient.builder()
                .requestFactory(new org.springframework.http.client.JdkClientHttpRequestFactory(
                        java.net.http.HttpClient.newBuilder()
                                .sslContext(sslBundles.getBundle("server").createSslContext())
                                .connectTimeout(Duration.ofSeconds(10))
                                .build()));
    }
}
