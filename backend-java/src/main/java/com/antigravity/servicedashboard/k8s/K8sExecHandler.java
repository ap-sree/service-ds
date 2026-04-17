package com.antigravity.servicedashboard.k8s;

import io.kubernetes.client.Exec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Component
public class K8sExecHandler extends TextWebSocketHandler {

    private static final Logger logger = LoggerFactory.getLogger(K8sExecHandler.class);
    private static final long IDLE_TIMEOUT_MS = 10 * 60 * 1000;
    private static final long MONITOR_INTERVAL_MS = 5 * 60 * 1000;

    private final K8sService service;
    private final Map<String, SessionInfo> sessions = new ConcurrentHashMap<>();
    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);

    public K8sExecHandler(K8sService service) {
        this.service = service;
        startMonitoring();
    }

    private void startMonitoring() {

        scheduler.scheduleAtFixedRate(() -> {
            try {
                long now = System.currentTimeMillis();
                int closedCount = 0;

                for (Map.Entry<String, SessionInfo> entry : sessions.entrySet()) {
                    SessionInfo info = entry.getValue();
                    long idleTime = now - info.lastActivity;

                    if (idleTime > IDLE_TIMEOUT_MS) {
                        logger.info("Closing idle session {} (idle for {} minutes)",
                                entry.getKey(), idleTime / 60000);
                        try {
                            info.session.close(CloseStatus.GOING_AWAY);
                        } catch (Exception e) {
                            logger.warn("Error closing idle session", e);
                        }
                        closedCount++;
                    }
                }


                int activeCount = sessions.size();
                logger.info("WebSocket Monitor - Active connections: {}, Closed idle: {}",
                        activeCount, closedCount);

            } catch (Exception e) {
                logger.error("Error in session monitor", e);
            }
        }, MONITOR_INTERVAL_MS, MONITOR_INTERVAL_MS, TimeUnit.MILLISECONDS);
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String query = session.getUri().getQuery();
        Map<String, String> params = parseQuery(query);

        String namespace = params.getOrDefault("namespace", "default");
        String pod = params.get("pod");
        String container = params.get("container");
        String command = params.getOrDefault("command", "/bin/sh");

        if (pod == null || pod.isBlank()) {
            session.close(CloseStatus.BAD_DATA);
            return;
        }


        java.util.Set<String> allowedShells = java.util.Set.of("/bin/sh", "/bin/bash", "sh", "bash");
        if (!allowedShells.contains(command)) {
            logger.warn("Security: Rejected disallowed command '{}' for pod {}/{}", command, namespace, pod);
            session.sendMessage(new TextMessage("Error: Command not allowed. Only sh/bash are permitted."));
            session.close(CloseStatus.BAD_DATA);
            return;
        }


        if (!namespace.matches("^[a-zA-Z0-9-]+$") || !pod.matches("^[a-zA-Z0-9-]+$")) {
            logger.warn("Security: Rejected invalid namespace/pod format: {}/{}", namespace, pod);
            session.close(CloseStatus.BAD_DATA);
            return;
        }

        try {
            logger.info("Starting exec session for pod: {}/{} (session: {})", namespace, pod, session.getId());
            Exec exec = new Exec(service.getClient());

            Process proc = exec.exec(namespace, pod, new String[] { command }, container, true, true);

            SessionInfo info = new SessionInfo(session, proc, namespace, pod);
            sessions.put(session.getId(), info);


            executor.submit(() -> pipeStream(proc.getInputStream(), session));

            executor.submit(() -> pipeStream(proc.getErrorStream(), session));

            logger.info("Total active WebSocket connections: {}", sessions.size());

        } catch (Exception e) {
            logger.error("Failed to start exec", e);
            session.sendMessage(new TextMessage("Error: " + e.getMessage()));
            session.close(CloseStatus.SERVER_ERROR);
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        SessionInfo info = sessions.get(session.getId());
        if (info != null) {
            info.updateActivity();
            OutputStream os = info.process.getOutputStream();
            os.write(message.getPayload().getBytes());
            os.flush();
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        SessionInfo info = sessions.remove(session.getId());
        if (info != null) {
            logger.info("Closing session {} for pod: {}/{} (duration: {} minutes)",
                    session.getId(), info.namespace, info.pod,
                    (System.currentTimeMillis() - info.startTime) / 60000);
            info.process.destroy();
        }
        logger.info("Total active WebSocket connections: {}", sessions.size());
    }

    private void pipeStream(InputStream is, WebSocketSession session) {
        try {
            byte[] buffer = new byte[1024];
            int read;
            while ((read = is.read(buffer)) != -1) {
                if (!session.isOpen())
                    break;
                session.sendMessage(new TextMessage(new String(buffer, 0, read)));


                SessionInfo info = sessions.get(session.getId());
                if (info != null) {
                    info.updateActivity();
                }
            }
        } catch (IOException e) {

        }
    }

    private Map<String, String> parseQuery(String query) {
        Map<String, String> map = new ConcurrentHashMap<>();
        if (query != null) {
            for (String param : query.split("&")) {
                String[] pair = param.split("=");
                if (pair.length == 2) {
                    map.put(pair[0], pair[1]);
                }
            }
        }
        return map;
    }

    private static class SessionInfo {
        final WebSocketSession session;
        final Process process;
        final String namespace;
        final String pod;
        final long startTime;
        volatile long lastActivity;

        SessionInfo(WebSocketSession session, Process process, String namespace, String pod) {
            this.session = session;
            this.process = process;
            this.namespace = namespace;
            this.pod = pod;
            this.startTime = System.currentTimeMillis();
            this.lastActivity = this.startTime;
        }

        void updateActivity() {
            this.lastActivity = System.currentTimeMillis();
        }
    }
}
