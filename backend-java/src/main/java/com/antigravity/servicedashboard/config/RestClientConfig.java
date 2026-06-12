package com.antigravity.servicedashboard.config;

import java.time.Duration;

import org.springframework.boot.ssl.SslBundles;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class RestClientConfig {

    @Bean
    RestClient.Builder restClientBuilder(SslBundles sslBundles) {
        return RestClient.builder()
                .requestFactory(new org.springframework.http.client.JdkClientHttpRequestFactory(
                        java.net.http.HttpClient.newBuilder()
                                .sslContext(sslBundles.getBundle("server").createSslContext())
                                .connectTimeout(Duration.ofSeconds(10))
                                .build()));
    }
}
