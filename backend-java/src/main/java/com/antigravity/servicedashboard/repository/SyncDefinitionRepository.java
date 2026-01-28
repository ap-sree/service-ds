package com.antigravity.servicedashboard.repository;

import com.antigravity.servicedashboard.entity.SyncDefinition;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SyncDefinitionRepository extends JpaRepository<SyncDefinition, Long> {
    List<SyncDefinition> findBySyncMode(String syncMode);

    List<SyncDefinition> findBySourceId(Long sourceId);
}
