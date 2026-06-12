package com.antigravity.servicedashboard.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.antigravity.servicedashboard.entity.User;
import com.antigravity.servicedashboard.model.UserPreferences;
import com.antigravity.servicedashboard.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
public class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private UserService userService;

    @Test
    public void testVerifyOrCreate_ExistingUser() {
        User user = new User();
        user.setUsername("existing");
        when(userRepository.findById("existing")).thenReturn(Optional.of(user));

        User result = userService.verifyOrCreate("existing");
        assertEquals("existing", result.getUsername());
        verify(userRepository, never()).save(any());
    }

    @Test
    public void testVerifyOrCreate_NewUser() {
        when(userRepository.findById("newuser")).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArguments()[0]);

        User result = userService.verifyOrCreate("newuser");
        assertEquals("newuser", result.getUsername());
        assertEquals("USER", result.getRole());
        verify(userRepository).save(any(User.class));
    }

    @Test
    public void testUpdateRole() {
        User user = new User();
        user.setUsername("user1");
        user.setRole("USER");
        when(userRepository.findById("user1")).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArguments()[0]);

        Optional<User> result = userService.updateRole("user1", "ADMIN");
        assertTrue(result.isPresent());
        assertEquals("ADMIN", result.get().getRole());
    }

    @Test
    public void testDelete_Exists() {
        when(userRepository.existsById("user1")).thenReturn(true);
        boolean result = userService.delete("user1");
        assertTrue(result);
        verify(userRepository).deleteById("user1");
    }

    @Test
    public void testDelete_NotExists() {
        when(userRepository.existsById("user1")).thenReturn(false);
        boolean result = userService.delete("user1");
        assertFalse(result);
        verify(userRepository, never()).deleteById("user1");
    }

    @Test
    public void testGetPreferences_Parsing() {
        User user = new User();
        user.setUsername("user1");
        // Valid JSON
        user.setPreferences("{\"theme\":\"dark\"}");
        when(userRepository.findById("user1")).thenReturn(Optional.of(user));

        UserPreferences prefs = userService.getPreferences("user1");
        assertNotNull(prefs);
        assertEquals("dark", prefs.getTheme());
    }

    @Test
    public void testGetPreferences_Null() {
        User user = new User();
        user.setUsername("user1");
        user.setPreferences((String) null);
        when(userRepository.findById("user1")).thenReturn(Optional.of(user));

        UserPreferences prefs = userService.getPreferences("user1");
        assertNotNull(prefs); // Should return empty default
        assertNull(prefs.getTheme());
    }
}
