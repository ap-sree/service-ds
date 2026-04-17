package com.antigravity.servicedashboard.controller;

import com.antigravity.servicedashboard.dto.AppConfigDTO;
import com.antigravity.servicedashboard.entity.AppConfig;
import com.antigravity.servicedashboard.mapper.AppConfigMapper;
import com.antigravity.servicedashboard.service.AppConfigService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/config")
public class ConfigController {

    private final AppConfigService service;
    private final AppConfigMapper configMapper;

    public ConfigController(AppConfigService service, AppConfigMapper configMapper) {
        this.service = service;
        this.configMapper = configMapper;
    }

    @GetMapping("/{key}")
    public ResponseEntity<Object> getConfig(@PathVariable String key) {
        Object value = service.getConfigValue(key);
        return ResponseEntity.ok(value);
    }

    @PostMapping
    public ResponseEntity<AppConfigDTO> setConfig(@Valid @RequestBody AppConfigDTO dto) {
        AppConfig saved = service.setConfigValue(dto.getKey(), dto.getValue());
        return ResponseEntity.ok(configMapper.toDTO(saved));
    }
}
