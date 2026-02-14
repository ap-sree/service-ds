package com.antigravity.servicedashboard.k8s;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class K8sWebSocketConfig implements WebSocketConfigurer {

    private final K8sExecHandler execHandler;

    public K8sWebSocketConfig(K8sExecHandler execHandler) {
        this.execHandler = execHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(execHandler, "/ws/k8s/exec")
                .setAllowedOrigins("*");
    }
}
