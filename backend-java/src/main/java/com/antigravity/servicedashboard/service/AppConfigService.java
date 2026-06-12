package com.antigravity.servicedashboard.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.antigravity.servicedashboard.entity.AppConfig;
import com.antigravity.servicedashboard.model.UserPreferences;
import com.antigravity.servicedashboard.repository.AppConfigRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class AppConfigService {

    @Autowired
    private AppConfigRepository repository;

    private final ObjectMapper mapper = new ObjectMapper();

    public Object getConfigValue(String key) {
        return repository.findById(key)
                .map(config -> {
                    try {
                        return mapper.readValue(config.getValue(), Object.class);
                    } catch (Exception e) {
                        return config.getValue();
                    }
                })
                .orElse(null);
    }

    public AppConfig setConfigValue(String key, Object valueObj) {
        String valueStr;
        try {
            valueStr = mapper.writeValueAsString(valueObj);
        } catch (Exception e) {
            valueStr = String.valueOf(valueObj);
        }

        AppConfig config = new AppConfig(key, valueStr);
        return repository.save(config);
    }

    public UserPreferences getGlobalDashboardLayout() {
        return repository.findById("global_dashboard_layout")
                .map(config -> {
                    try {
                        return mapper.readValue(config.getValue(),
                                UserPreferences.class);
                    } catch (Exception e) {
                        return new UserPreferences();
                    }
                })
                .orElse(new UserPreferences());
    }
}
