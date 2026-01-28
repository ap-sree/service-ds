package com.antigravity.servicedashboard.repository;

import com.antigravity.servicedashboard.entity.AppConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AppConfigRepository extends JpaRepository<AppConfig, String> {
}
