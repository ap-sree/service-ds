package com.antigravity.servicedashboard.controller;

import com.antigravity.servicedashboard.entity.NotificationRule;
import com.antigravity.servicedashboard.repository.NotificationRuleRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/notification-rules")
public class NotificationRuleController {

    private final NotificationRuleRepository repository;
    private final com.antigravity.servicedashboard.repository.SyncDefinitionRepository syncRepo;

    public NotificationRuleController(NotificationRuleRepository repository,
            com.antigravity.servicedashboard.repository.SyncDefinitionRepository syncRepo) {
        this.repository = repository;
        this.syncRepo = syncRepo;
    }

    @GetMapping
    public List<NotificationRule> getAll() {
        return repository.findAll();
    }

    @PostMapping
    public NotificationRule create(@Valid @RequestBody NotificationRule entity) {
        if (entity.getLocalTableName() != null) {
            syncRepo.findFirstByTargetTableName(entity.getLocalTableName())
                    .ifPresent(entity::setSyncDefinition);
        }
        return repository.save(entity);
    }

    @PutMapping("/{id}")
    public ResponseEntity<NotificationRule> update(@PathVariable Long id, @Valid @RequestBody NotificationRule entity) {
        if (!repository.existsById(id))
            return ResponseEntity.notFound().build();
        entity.setId(id);
        if (entity.getLocalTableName() != null) {
            syncRepo.findFirstByTargetTableName(entity.getLocalTableName())
                    .ifPresent(entity::setSyncDefinition);
        }
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
