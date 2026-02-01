package com.antigravity.servicedashboard.service;

import com.antigravity.servicedashboard.entity.DataSource;
import com.antigravity.servicedashboard.repository.DataSourceRepository;
import com.antigravity.servicedashboard.entity.SyncDefinition;
import com.antigravity.servicedashboard.repository.SyncDefinitionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

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
            syncService.deleteSyncCascade(sync.getId());
        }

        
        repository.deleteById(id);
        return true;
    }
}
