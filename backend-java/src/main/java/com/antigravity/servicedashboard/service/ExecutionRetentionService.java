package com.antigravity.servicedashboard.service;

import java.time.LocalDateTime;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.antigravity.servicedashboard.repository.TaskExecutionRepository;

@Service
public class ExecutionRetentionService {

    private static final Logger log = LoggerFactory.getLogger(ExecutionRetentionService.class);

    private final TaskExecutionRepository executionRepo;

    @Value("${automation.retention.blob-days:7}")
    private int blobRetentionDays;

    @Value("${automation.retention.record-days:30}")
    private int recordRetentionDays;

    public ExecutionRetentionService(TaskExecutionRepository executionRepo) {
        this.executionRepo = executionRepo;
    }

    @Scheduled(cron = "0 0 2 * * *")
    @Transactional
    public void purge() {
        LocalDateTime now = LocalDateTime.now();

        LocalDateTime recordCutoff = now.minusDays(recordRetentionDays);
        int deleted = executionRepo.deleteOlderThan(recordCutoff);

        LocalDateTime blobCutoff = now.minusDays(blobRetentionDays);
        int blobsCleared = executionRepo.clearBlobsOlderThan(blobCutoff);

        log.info("Execution retention: deleted {} record(s) older than {} days, " +
                 "cleared LOBs on {} record(s) older than {} days",
                 deleted, recordRetentionDays, blobsCleared, blobRetentionDays);
    }
}
