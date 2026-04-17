package com.antigravity.servicedashboard.controller;

import com.antigravity.servicedashboard.dto.UserDTO;
import com.antigravity.servicedashboard.entity.User;
import com.antigravity.servicedashboard.mapper.UserMapper;
import com.antigravity.servicedashboard.service.UserService;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/users")
public class UserController {

    private final UserService service;
    private final UserMapper userMapper;

    public UserController(UserService service, UserMapper userMapper) {
        this.service = service;
        this.userMapper = userMapper;
    }

    @GetMapping
    public ResponseEntity<List<UserDTO>> getUsers() {
        List<User> users = service.getAll();
        return ResponseEntity.ok(userMapper.toDTOList(users));
    }

    @PostMapping
    public ResponseEntity<UserDTO> createUser(@Valid @RequestBody UserDTO dto) {
        User user = userMapper.toEntity(dto);
        return service.create(user)
                .map(userMapper::toDTO)
                .map(ResponseEntity::ok)
                .orElseThrow(() -> new IllegalArgumentException("User already exists"));
    }

    @PutMapping("/{username}/role")
    public ResponseEntity<UserDTO> updateRole(@PathVariable String username,
            @Valid @RequestBody UserDTO dto) {
        return service.updateRole(username, dto.getRole())
                .map(userMapper::toDTO)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{username}")
    public ResponseEntity<UserDTO> updateUser(@PathVariable String username, @Valid @RequestBody UserDTO dto) {
        User user = userMapper.toEntity(dto);
        return service.updateUser(username, user)
                .map(userMapper::toDTO)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{username}")

    public ResponseEntity<Void> deleteUser(@PathVariable String username) {
        if (service.delete(username)) {
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.notFound().build();
    }

    @GetMapping("/{username}/preferences")

    public ResponseEntity<com.antigravity.servicedashboard.model.UserPreferences> getPreferences(
            @PathVariable String username) {
        com.antigravity.servicedashboard.model.UserPreferences prefs = service.getPreferences(username);
        return ResponseEntity.ok(prefs);
    }

    @PostMapping("/{username}/preferences")
    public ResponseEntity<UserDTO> updatePreferences(@PathVariable String username,
            @RequestBody com.antigravity.servicedashboard.model.UserPreferences prefs) {
        return service.updatePreferences(username, prefs)
                .map(userMapper::toDTO)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
