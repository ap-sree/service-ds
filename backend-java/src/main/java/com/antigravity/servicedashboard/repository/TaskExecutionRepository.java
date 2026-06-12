package com.antigravity.servicedashboard.repository;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.antigravity.servicedashboard.dto.TaskExecutionSummary;
import com.antigravity.servicedashboard.entity.TaskExecution;

@Repository
public interface TaskExecutionRepository extends JpaRepository<TaskExecution, Long> {
    List<TaskExecution> findByTaskIdAndTaskTypeOrderByStartedAtDesc(Long taskId, String taskType);

    List<TaskExecutionSummary> findSummaryByTaskIdAndTaskTypeOrderByStartedAtDesc(Long taskId, String taskType);

    @Modifying(clearAutomatically = true)
    @Query("UPDATE TaskExecution t SET t.inputPayload = null, t.outputResult = null " +
           "WHERE t.startedAt < :cutoff " +
           "AND (t.inputPayload IS NOT NULL OR t.outputResult IS NOT NULL)")
    int clearBlobsOlderThan(@Param("cutoff") LocalDateTime cutoff);


    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM TaskExecution t WHERE t.startedAt < :cutoff")
    int deleteOlderThan(@Param("cutoff") LocalDateTime cutoff);
}
