package com.antigravity.servicedashboard.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.Base64;
import java.nio.charset.StandardCharsets;

@Service
public class ShellService {

    private static final Logger logger = LoggerFactory.getLogger(ShellService.class);
    private final ObjectMapper objectMapper;

    public ShellService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public List<Map<String, Object>> executeCommand(String command, String cwd) {
        logger.info("Executing Shell Command: {}", command);
        List<String> outputLines = new ArrayList<>();

        try {
            boolean isWindows = System.getProperty("os.name").toLowerCase().contains("win");
            ProcessBuilder builder = new ProcessBuilder();

            if (isWindows) {
                // Use EncodedCommand to avoid quoting/escaping issues with special chars like |
                // $ "
                String encodedCmd = Base64.getEncoder().encodeToString(command.getBytes(StandardCharsets.UTF_16LE));
                builder.command("powershell.exe", "-EncodedCommand", encodedCmd);
            } else {
                builder.command("sh", "-c", command);
            }

            if (cwd != null && !cwd.isEmpty()) {
                builder.directory(new java.io.File(cwd));
            }

            Process process = builder.start();

            // Read Output
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    outputLines.add(line);
                }
            }

            // Read Error (Optional: Log it)
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getErrorStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    logger.error("Stderr: {}", line);
                }
            }

            boolean finished = process.waitFor(30, TimeUnit.SECONDS);
            if (!finished) {
                process.destroy();
                throw new RuntimeException("Command timed out");
            }

            if (process.exitValue() != 0) {
                throw new RuntimeException("Command exited with code " + process.exitValue());
            }

            return parseOutput(outputLines);

        } catch (Exception e) {
            logger.error("Shell Execution Failed", e);
            throw new RuntimeException(e);
        }
    }

    private List<Map<String, Object>> parseOutput(List<String> lines) {
        // Build full string
        String fullOutput = String.join("\n", lines).trim();

        if (fullOutput.isEmpty()) {
            return Collections.emptyList();
        }

        // 1. Try JSON
        if (fullOutput.startsWith("[") || fullOutput.startsWith("{")) {
            try {
                if (fullOutput.startsWith("[")) {
                    return objectMapper.readValue(fullOutput, new TypeReference<List<Map<String, Object>>>() {
                    });
                } else {
                    Map<String, Object> obj = objectMapper.readValue(fullOutput,
                            new TypeReference<Map<String, Object>>() {
                            });
                    return Collections.singletonList(obj);
                }
            } catch (Exception e) {
                logger.warn("Output looked like JSON but failed to parse. Falling back to text line.");
            }
        }

        // 2. Fallback: Return raw lines as objects
        // Useful for user to debug: { "output": "line..." }
        List<Map<String, Object>> result = new ArrayList<>();
        for (String line : lines) {
            result.add(Collections.singletonMap("output", line));
        }
        return result;
    }
}
