package com.antigravity.servicedashboard.service;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.antigravity.servicedashboard.entity.NotificationRule;
import com.antigravity.servicedashboard.repository.NotificationRuleRepository;
import com.antigravity.servicedashboard.repository.SyncDefinitionRepository;

@Service
public class NotificationRuleService {

    private final NotificationRuleRepository repository;
    private final SyncDefinitionRepository syncRepo;

    public NotificationRuleService(NotificationRuleRepository repository, SyncDefinitionRepository syncRepo) {
        this.repository = repository;
        this.syncRepo = syncRepo;
    }

    public List<NotificationRule> getAll() {
        return repository.findAll();
    }

    public NotificationRule create(NotificationRule entity) {
        if (entity.getLocalTableName() != null) {
            syncRepo.findFirstByTargetTableName(entity.getLocalTableName())
                    .ifPresent(entity::setSyncDefinition);
        }
        return repository.save(entity);
    }

    public Optional<NotificationRule> update(Long id, NotificationRule entity) {
        if (!repository.existsById(id))
            return Optional.empty();
        entity.setId(id);
        entity.setSchemaChanged(false);
        if (entity.getLocalTableName() != null) {
            syncRepo.findFirstByTargetTableName(entity.getLocalTableName())
                    .ifPresent(entity::setSyncDefinition);
        }
        return Optional.of(repository.save(entity));
    }

    public boolean delete(Long id) {
        if (!repository.existsById(id))
            return false;
        repository.deleteById(id);
        return true;
    }
}
