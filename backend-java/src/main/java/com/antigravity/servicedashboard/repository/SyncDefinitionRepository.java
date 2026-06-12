package com.antigravity.servicedashboard.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.antigravity.servicedashboard.entity.SyncDefinition;

public interface SyncDefinitionRepository extends JpaRepository<SyncDefinition, Long> {
    List<SyncDefinition> findBySyncMode(String syncMode);

    List<SyncDefinition> findBySourceId(Long sourceId);

    java.util.Optional<SyncDefinition> findFirstByTargetTableName(String targetTableName);
}
