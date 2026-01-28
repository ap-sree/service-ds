package com.antigravity.servicedashboard.controller;

import com.antigravity.servicedashboard.entity.AppConfig;
import com.antigravity.servicedashboard.service.AppConfigService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/config")
public class ConfigController {

    private final AppConfigService service;

    @Autowired
    public ConfigController(AppConfigService service) {
        this.service = service;
    }

    @GetMapping("/{key}")
    public ResponseEntity<Object> getConfig(@PathVariable String key) {
        Object value = service.getConfigValue(key);
        return ResponseEntity.ok(value);
    }

    @PostMapping
    public AppConfig setConfig(@RequestBody AppConfig config) {
        return service.setConfigValue(config.getKey(), config.getValue());
    }
}
