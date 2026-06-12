package com.antigravity.servicedashboard.service;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.antigravity.servicedashboard.entity.DataSource;
import com.antigravity.servicedashboard.entity.SyncDefinition;
import com.antigravity.servicedashboard.repository.DataSourceRepository;
import com.antigravity.servicedashboard.repository.SyncDefinitionRepository;

@Service
public class DataSourceService {

    @Autowired
    private DataSourceRepository repository;

    @Autowired
    private SyncDefinitionRepository syncRepo;

    @Autowired
    private SyncService syncService;

    public List<DataSource> getAll() {
        return repository.findAll();
    }

    public DataSource create(DataSource entity) {
        return repository.save(entity);
    }

    public Optional<DataSource> update(Long id, DataSource entity) {
        if (!repository.existsById(id))
            return Optional.empty();
        entity.setId(id);
        return Optional.of(repository.save(entity));
    }

    public boolean delete(Long id) {
        if (!repository.existsById(id))
            return false;


        List<SyncDefinition> syncs = syncRepo.findBySourceId(id);
        for (SyncDefinition sync : syncs) {
            sync.setSchemaChanged(true);
            for (com.antigravity.servicedashboard.entity.WidgetDefinition w : sync.getWidgets()) {
                w.setSchemaChanged(true);
            }
            for (com.antigravity.servicedashboard.entity.NotificationRule n : sync.getNotificationRules()) {
                n.setSchemaChanged(true);
            }
        }
        syncRepo.saveAll(syncs);

        repository.deleteById(id);
        return true;
    }
}
