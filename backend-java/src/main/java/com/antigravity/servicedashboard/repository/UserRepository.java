package com.antigravity.servicedashboard.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.antigravity.servicedashboard.entity.User;

public interface UserRepository extends JpaRepository<User, String> {
}
