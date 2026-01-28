package com.antigravity.servicedashboard.repository;

import com.antigravity.servicedashboard.entity.DataSource;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DataSourceRepository extends JpaRepository<DataSource, Long> {
}
