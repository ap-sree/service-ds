package com.antigravity.servicedashboard.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import com.antigravity.servicedashboard.entity.WidgetDefinition;

public interface WidgetDefinitionRepository extends JpaRepository<WidgetDefinition, Long> {
    @Transactional
    void deleteByDataSourceTable(String dataSourceTable);

    @Transactional
    @Modifying
    @Query("UPDATE WidgetDefinition w SET w.dataSourceTable = ?2 WHERE w.dataSourceTable = ?1")
    void updateDataSourceTable(String oldName, String newName);
}
