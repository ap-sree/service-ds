package com.antigravity.servicedashboard.service;

import com.antigravity.servicedashboard.constant.AppConstants;
import com.antigravity.servicedashboard.entity.NotificationRule;
import com.antigravity.servicedashboard.model.Notification;
import com.antigravity.servicedashboard.repository.NotificationRuleRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Queue;
import java.util.concurrent.ConcurrentLinkedQueue;

@Service
public class NotificationService {

    private static final Logger logger = LoggerFactory.getLogger(NotificationService.class);
    private final Queue<Notification> notificationQueue = new ConcurrentLinkedQueue<>();

    private final NotificationRuleRepository ruleRepo;
    private final com.antigravity.servicedashboard.repository.UserRepository userRepo;
    private final JdbcTemplate jdbcTemplate;

    public NotificationService(NotificationRuleRepository ruleRepo,
            com.antigravity.servicedashboard.repository.UserRepository userRepo,
            JdbcTemplate jdbcTemplate) {
        this.ruleRepo = ruleRepo;
        this.userRepo = userRepo;
        this.jdbcTemplate = jdbcTemplate;
    }

    // Run every minute (Scheduled Rules)
    @Scheduled(fixedDelay = 60000)
    public void checkRules() {
        // Implementation for CRON or other scheduled types to be added
    }

    public void triggerEventRules(String tableName) {
        logger.info("Triggering EVENT rules for table: {}", tableName);
        List<NotificationRule> rules = ruleRepo.findAll();
        for (NotificationRule rule : rules) {
            if ("EVENT".equals(rule.getScheduleType()) && tableName.equals(rule.getLocalTableName())) {
                evaluateRule(rule);
            }
        }
    }

    private void evaluateRule(NotificationRule rule) {
        try {
            com.antigravity.servicedashboard.model.NotificationCondition condition = rule.getCondition();
            if (condition == null)
                return;

            String operation = condition.getOperation() != null ? condition.getOperation() : AppConstants.OP_COUNT;
            String column = condition.getColumn() != null ? condition.getColumn() : "*";
            String sqlFilter = condition.getCondition() != null ? condition.getCondition() : "";
            String thresholdOp = condition.getThresholdOperator() != null ? condition.getThresholdOperator() : ">";
            double thresholdVal = condition.getThresholdValue() != null ? condition.getThresholdValue() : 0.0;

            // Safety check for SQL Injection on Column Name
            if (!column.matches("^[a-zA-Z0-9_*]+$"))
                column = "*";
            if (!sqlFilter.isEmpty() && !sqlFilter.toUpperCase().trim().startsWith("WHERE")) {
                sqlFilter = "WHERE " + sqlFilter;
            }

            executeQueryAndNotify(rule, operation, column, sqlFilter, thresholdOp, thresholdVal);

        } catch (Exception e) {
            logger.error("Error evaluating rule ID " + rule.getId(), e);
        }
    }

    private void executeQueryAndNotify(NotificationRule rule, String operation, String column, String sqlFilter,
            String thresholdOp, double thresholdVal) {
        String table = "\"" + rule.getLocalTableName() + "\"";
        String query;

        if (rule.getUserColumn() != null && !rule.getUserColumn().isEmpty()) {
            query = String.format("SELECT \"%s\" as user, %s(%s) as val FROM %s %s GROUP BY \"%s\"",
                    rule.getUserColumn(), operation, column, table, sqlFilter, rule.getUserColumn());

            List<Map<String, Object>> rows = jdbcTemplate.queryForList(query);
            for (Map<String, Object> row : rows) {
                Number val = (Number) row.get("val");
                String user = (String) row.get("user");
                if (checkThreshold(val, thresholdOp, thresholdVal)) {
                    queueNotification(rule, val, user);
                }
            }
        } else {
            query = String.format("SELECT %s(%s) FROM %s %s", operation, column, table, sqlFilter);
            Double result = jdbcTemplate.queryForObject(query, Double.class); // NOSONAR: simplified query

            if (result != null && checkThreshold(result, thresholdOp, thresholdVal)) {
                queueNotification(rule, result, null);
            }
        }
    }

    private boolean checkThreshold(Number actual, String op, double target) {
        if (actual == null)
            return false;
        double a = actual.doubleValue();

        switch (op) {
            case ">":
                return a > target;
            case "<":
                return a < target;
            case "=":
                return a == target;
            case "!=":
                return Math.abs(a - target) > 0.00001;
            case ">=":
                return a >= target;
            case "<=":
                return a <= target;
            default:
                return false;
        }
    }

    private void queueNotification(NotificationRule rule, Number value, String targetUser) {
        String safeValue = String.valueOf(value);
        String body = rule.getMessageTemplate() != null
                ? rule.getMessageTemplate().replace("{{value}}", safeValue)
                : "Alert: Rule triggered. Value: " + safeValue;

        String title = (rule.getTitleTemplate() != null && !rule.getTitleTemplate().isEmpty())
                ? rule.getTitleTemplate()
                : "Service Alert";

        Notification n = new Notification(
                title,
                body,
                rule.getActionType(),
                targetUser,
                rule.getTargetRole());

        notificationQueue.add(n);
        logger.info("Queued Notification. User: {}, Role: {}, Body: {}", targetUser, rule.getTargetRole(), body);
    }

    public List<Notification> getPendingNotifications(String username) {
        List<Notification> userNotifications = new ArrayList<>();
        List<Notification> remaining = new ArrayList<>();

        // Resolve User Role
        String userRole = null;
        if (username != null && !username.isEmpty()) {
            var userOpt = userRepo.findById(username);
            if (userOpt.isPresent()) {
                userRole = userOpt.get().getRole();
            }
        }

        while (!notificationQueue.isEmpty()) {
            Notification n = notificationQueue.poll();
            if (n == null)
                break;

            boolean isMatch = false;

            if (n.getTargetUser() != null) {
                if (username != null && n.getTargetUser().equalsIgnoreCase(username)) {
                    isMatch = true;
                }
            } else if (n.getTargetRole() != null) {
                if (userRole != null && n.getTargetRole().equalsIgnoreCase(userRole)) {
                    isMatch = true;
                }
            } else {
                isMatch = true;
            }

            if (isMatch) {
                userNotifications.add(n);
            } else {
                remaining.add(n);
            }
        }
        notificationQueue.addAll(remaining);
        return userNotifications;
    }
}
