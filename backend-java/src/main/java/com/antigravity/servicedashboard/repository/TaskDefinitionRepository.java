package com.antigravity.servicedashboard.repository;
import com.antigravity.servicedashboard.entity.TaskDefinition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
@Repository
public interface TaskDefinitionRepository extends JpaRepository<TaskDefinition, Long> {
}
