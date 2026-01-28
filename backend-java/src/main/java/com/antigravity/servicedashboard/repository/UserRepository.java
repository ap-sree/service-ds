package com.antigravity.servicedashboard.repository;

import com.antigravity.servicedashboard.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, String> {
}
