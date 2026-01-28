package com.antigravity.servicedashboard.controller;

import com.antigravity.servicedashboard.entity.NotificationRule;
import com.antigravity.servicedashboard.repository.NotificationRuleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notification-rules")
public class NotificationRuleController {

    private final NotificationRuleRepository repository;

    @Autowired
    public NotificationRuleController(NotificationRuleRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public List<NotificationRule> getAll() {
        return repository.findAll();
    }

    @PostMapping
    public NotificationRule create(@RequestBody NotificationRule entity) {
        return repository.save(entity);
    }

    @PutMapping("/{id}")
    public ResponseEntity<NotificationRule> update(@PathVariable Long id, @RequestBody NotificationRule entity) {
        if (!repository.existsById(id))
            return ResponseEntity.notFound().build();
        entity.setId(id);
        return ResponseEntity.ok(repository.save(entity));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!repository.existsById(id))
            return ResponseEntity.notFound().build();
        repository.deleteById(id);
        return ResponseEntity.ok().build();
    }
}
