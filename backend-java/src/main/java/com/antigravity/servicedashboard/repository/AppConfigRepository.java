package com.antigravity.servicedashboard.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.antigravity.servicedashboard.entity.AppConfig;

@Repository
public interface AppConfigRepository extends JpaRepository<AppConfig, String> {
}
