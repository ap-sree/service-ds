package com.antigravity.servicedashboard.repository;
import com.antigravity.servicedashboard.entity.TaskExecution;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
@Repository
public interface TaskExecutionRepository extends JpaRepository<TaskExecution, Long> {
    List<TaskExecution> findByTaskIdOrderByStartedAtDesc(Long taskId);
}
