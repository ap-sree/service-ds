package com.antigravity.servicedashboard.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.antigravity.servicedashboard.entity.DataSource;

public interface DataSourceRepository extends JpaRepository<DataSource, Long> {
}
