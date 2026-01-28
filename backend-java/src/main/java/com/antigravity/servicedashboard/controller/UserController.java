package com.antigravity.servicedashboard.controller;

import com.antigravity.servicedashboard.entity.User;
import com.antigravity.servicedashboard.service.UserService;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class UserController {

    private final UserService service;

    public UserController(UserService service) {
        this.service = service;
    }

    @PostMapping("/auth/login")
    public ResponseEntity<User> login(@RequestBody User user) {
        if (user.getUsername() == null)
            throw new IllegalArgumentException("Username required");

        User verifiedUser = service.verifyOrCreate(user.getUsername());
        return ResponseEntity.ok(verifiedUser);
    }

    @GetMapping("/users")
    public List<User> getUsers() {
        return service.getAll();
    }

    @PostMapping("/users")
    public ResponseEntity<User> createUser(@RequestBody User user) {
        return service.create(user)
                .map(ResponseEntity::ok)
                .orElseThrow(() -> new IllegalArgumentException("User already exists"));
    }

    @PutMapping("/users/{username}/role")
    public ResponseEntity<User> updateRole(@PathVariable String username,
            @RequestBody User user) {
        return service.updateRole(username, user.getRole())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/users/{username}")
    public ResponseEntity<Void> deleteUser(@PathVariable String username) {
        if (service.delete(username)) {
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.notFound().build();
    }

    @GetMapping("/users/{username}/preferences")
    public ResponseEntity<com.antigravity.servicedashboard.model.UserPreferences> getPreferences(
            @PathVariable String username) {
        com.antigravity.servicedashboard.model.UserPreferences prefs = service.getPreferences(username);
        return ResponseEntity.ok(prefs);
    }

    @PostMapping("/users/{username}/preferences")
    public ResponseEntity<User> updatePreferences(@PathVariable String username,
            @RequestBody com.antigravity.servicedashboard.model.UserPreferences prefs) {
        return service.updatePreferences(username, prefs)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
