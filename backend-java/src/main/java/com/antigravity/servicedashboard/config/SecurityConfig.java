package com.antigravity.servicedashboard.config;

import java.util.Collections;

import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ssl.SslBundles;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.client.RestTemplate;

import jakarta.annotation.PostConstruct;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

        @Value("${spring.security.oauth2.resourceserver.jwt.jwk-set-uri}")
        private String jwkSetUri;

        @Value("${app.ssl.disable-hostname-verification:false}")
        private boolean disableHostnameVerification;

        @PostConstruct
        public void init() {
                if (disableHostnameVerification) {
                        HttpsURLConnection.setDefaultHostnameVerifier((hostname, session) -> true);
                }
        }

        @Bean
        public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
                http
                                .authorizeHttpRequests(auth -> auth
                                                .requestMatchers("/h2-console/**").permitAll()
                                                .anyRequest().authenticated())
                                .csrf(csrf -> csrf.ignoringRequestMatchers("/h2-console/**"))
                                .headers(headers -> headers.frameOptions(frameOptions -> frameOptions.sameOrigin()))
                                .oauth2ResourceServer(oauth2 -> oauth2
                                                .jwt(Customizer.withDefaults()));

                return http.build();
        }

        @Bean
        public JwtDecoder jwtDecoder(SslBundles sslBundles) {
                SSLContext sslContext = sslBundles.getBundle("server").createSslContext();
                SSLContext.setDefault(sslContext);
                RestTemplate rest = new RestTemplate();
                return NimbusJwtDecoder.withJwkSetUri(jwkSetUri)
                                .jwsAlgorithms(algorithms -> Collections.addAll(algorithms,
                                                SignatureAlgorithm.values()))
                                .restOperations(rest)
                                .build();
        }
}

