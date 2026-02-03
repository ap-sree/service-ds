package com.antigravity.servicedashboard.controller;

import com.antigravity.servicedashboard.entity.User;
import com.antigravity.servicedashboard.service.UserService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Collections;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(UserController.class)
public class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserService userService;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    public void testGetUsers() throws Exception {
        when(userService.getAll()).thenReturn(Collections.emptyList());

        mockMvc.perform(get("/api/users"))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));
    }

    @Test
    public void testCreateUser() throws Exception {
        User user = new User();
        user.setUsername("testuser");
        when(userService.create(any(User.class))).thenReturn(Optional.of(user));

        mockMvc.perform(post("/api/users")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("testuser"));
    }

    @Test
    public void testLogin_Success() throws Exception {
        User user = new User();
        user.setUsername("loginUser");
        when(userService.verifyOrCreate("loginUser")).thenReturn(user);

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("loginUser"));
    }

    @Test
    public void testDeleteUser_Success() throws Exception {
        when(userService.delete("user1")).thenReturn(true);

        mockMvc.perform(delete("/api/users/user1"))
                .andExpect(status().isOk());
    }

    @Test
    public void testDeleteUser_NotFound() throws Exception {
        when(userService.delete("user1")).thenReturn(false);

        mockMvc.perform(delete("/api/users/user1"))
                .andExpect(status().isNotFound());
    }
}
