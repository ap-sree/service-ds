package com.antigravity.servicedashboard.service;

import com.antigravity.servicedashboard.entity.User;
import com.antigravity.servicedashboard.model.UserPreferences;
import com.antigravity.servicedashboard.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class UserService {

    private final UserRepository repository;

    public UserService(UserRepository repository) {
        this.repository = repository;
    }

    private final ObjectMapper objectMapper = new ObjectMapper();

    public User verifyOrCreate(String username) {
        return repository.findById(username).orElseGet(() -> {
            User newUser = new User();
            newUser.setUsername(username);
            newUser.setRole("USER");
            return repository.save(newUser);
        });
    }

    public List<User> getAll() {
        return repository.findAll();
    }

    public Optional<User> create(User user) {
        if (repository.existsById(user.getUsername()))
            return Optional.empty();
        return Optional.of(repository.save(user));
    }

    public Optional<User> updateRole(String username, String role) {
        return repository.findById(username).map(user -> {
            user.setRole(role);
            return repository.save(user);
        });
    }

    public boolean delete(String username) {
        if (!repository.existsById(username))
            return false;
        repository.deleteById(username);
        return true;
    }

    public UserPreferences getPreferences(String username) {
        return repository.findById(username).map(user -> {
            try {
                if (user.getPreferences() == null)
                    return new com.antigravity.servicedashboard.model.UserPreferences();
                return objectMapper.readValue(user.getPreferences(),
                        com.antigravity.servicedashboard.model.UserPreferences.class);
            } catch (Exception e) {
                return new com.antigravity.servicedashboard.model.UserPreferences();
            }
        }).orElse(null);
    }

    public Optional<User> updatePreferences(String username,
            UserPreferences prefs) {
        return repository.findById(username).map(user -> {
            try {
                if (prefs == null || (prefs.getWidgetIds() == null && prefs.getTheme() == null && prefs.getRefreshInterval() == null)) {
                    user.setPreferences((String) null);
                } else {
                    user.setPreferences(objectMapper.writeValueAsString(prefs));
                }
                return repository.save(user);
            } catch (Exception e) {
                throw new IllegalArgumentException("Failed to update preferences", e);
            }
        });
    }

    public Optional<User> updateUser(String username, User updatedUser) {
        return repository.findById(username).map(user -> {
            if (updatedUser.getRole() != null) {
                user.setRole(updatedUser.getRole());
            }
            return repository.save(user);
        });
    }
}
