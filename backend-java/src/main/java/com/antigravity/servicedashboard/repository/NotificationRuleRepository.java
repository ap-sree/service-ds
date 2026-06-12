package com.antigravity.servicedashboard.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import com.antigravity.servicedashboard.entity.NotificationRule;

public interface NotificationRuleRepository extends JpaRepository<NotificationRule, Long> {
    @Transactional
    void deleteByLocalTableName(String localTableName);

    List<NotificationRule> findByLocalTableName(String localTableName);

    @Transactional
    @Modifying
    @Query("UPDATE NotificationRule n SET n.localTableName = ?2 WHERE n.localTableName = ?1")
    void updateLocalTableName(String oldName, String newName);
}
