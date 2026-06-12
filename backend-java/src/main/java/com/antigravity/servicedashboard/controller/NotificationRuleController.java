package com.antigravity.servicedashboard.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.antigravity.servicedashboard.entity.NotificationRule;
import com.antigravity.servicedashboard.service.NotificationRuleService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/notification-rules")
public class NotificationRuleController {

    private final NotificationRuleService service;

    public NotificationRuleController(NotificationRuleService service) {
        this.service = service;
    }

    @GetMapping
    public List<NotificationRule> getAll() {
        return service.getAll();
    }

    @PostMapping
    public NotificationRule create(@Valid @RequestBody NotificationRule entity) {
        return service.create(entity);
    }

    @PutMapping("/{id}")
    public ResponseEntity<NotificationRule> update(@PathVariable Long id, @Valid @RequestBody NotificationRule entity) {
        return service.update(id, entity)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!service.delete(id))
            return ResponseEntity.notFound().build();
        return ResponseEntity.ok().build();
    }
}
