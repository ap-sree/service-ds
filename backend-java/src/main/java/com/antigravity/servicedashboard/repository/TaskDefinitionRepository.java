package com.antigravity.servicedashboard.repository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.antigravity.servicedashboard.entity.TaskDefinition;
@Repository
public interface TaskDefinitionRepository extends JpaRepository<TaskDefinition, Long> {
}
