package com.antigravity.servicedashboard.repository;

import com.antigravity.servicedashboard.entity.NotificationRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface NotificationRuleRepository extends JpaRepository<NotificationRule, Long> {
    @Transactional
    void deleteByLocalTableName(String localTableName);

    List<NotificationRule> findByLocalTableName(String localTableName);

    @Transactional
    @Modifying
    @Query("UPDATE NotificationRule n SET n.localTableName = ?2 WHERE n.localTableName = ?1")
    void updateLocalTableName(String oldName, String newName);
}
