package com.antigravity.servicedashboard.service;

import com.antigravity.servicedashboard.constant.AppConstants;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.antigravity.servicedashboard.util.MessageUtils;

@Service
public class FileService {

    private final ObjectMapper mapper = new ObjectMapper();

    
    public List<Map<String, Object>> readFile(String filePath, String format) throws IOException {
        File file = new File(filePath);
        if (!file.exists() || !file.isFile()) {
            throw new IOException(MessageUtils.get("error.file.notfound", filePath));
        }

        String determinedFormat = format;
        if (format == null || AppConstants.FORMAT_AUTO.equalsIgnoreCase(format)) {
            String name = file.getName().toLowerCase();
            if (name.endsWith(".json"))
                determinedFormat = AppConstants.FORMAT_JSON;
            else if (name.endsWith(".csv"))
                determinedFormat = AppConstants.FORMAT_CSV;
            else
                determinedFormat = AppConstants.FORMAT_TEXT;
        }

        if (AppConstants.FORMAT_JSON.equalsIgnoreCase(determinedFormat)) {
            return parseJson(file);
        } else if (AppConstants.FORMAT_CSV.equalsIgnoreCase(determinedFormat)) {
            return parseCsv(file);
        } else {
            
            return parseText(file);
        }
    }

    private List<Map<String, Object>> parseJson(File file) throws IOException {
        try {
            
            return mapper.readValue(file, new TypeReference<List<Map<String, Object>>>() {
            });
        } catch (Exception e) {
            
            List<Map<String, Object>> result = new ArrayList<>();
            List<String> lines = Files.readAllLines(file.toPath());
            for (String line : lines) {
                if (line.trim().isEmpty())
                    continue;
                try {
                    Map<String, Object> row = mapper.readValue(line, new TypeReference<Map<String, Object>>() {
                    });
                    result.add(row);
                } catch (Exception ex) {
                    throw new IOException(MessageUtils.get("error.file.invalidjson"), ex);
                }
            }
            return result;
        }
    }

    private List<Map<String, Object>> parseCsv(File file) throws IOException {
        List<Map<String, Object>> result = new ArrayList<>();
        try (BufferedReader br = new BufferedReader(new FileReader(file))) {
            String headerLine = br.readLine();
            if (headerLine == null)
                return result;

            
            String[] headers = headerLine.split(",");
            for (int i = 0; i < headers.length; i++) {
                headers[i] = headers[i].trim().replaceAll("^\"|\"$", "");
            }

            String line;
            while ((line = br.readLine()) != null) {
                if (line.trim().isEmpty())
                    continue;
                String[] values = line.split(",(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)"); 
                Map<String, Object> row = new LinkedHashMap<>();
                for (int i = 0; i < headers.length; i++) {
                    String val = (i < values.length) ? values[i].trim().replaceAll("^\"|\"$", "") : null;
                    row.put(headers[i], val);
                }
                result.add(row);
            }
        }
        return result;
    }

    private List<Map<String, Object>> parseText(File file) throws IOException {
        List<Map<String, Object>> result = new ArrayList<>();
        List<String> lines = Files.readAllLines(file.toPath());
        for (int i = 0; i < lines.size(); i++) {
            result.add(Map.of("line", i + 1, "content", lines.get(i)));
        }
        return result;
    }
}
