package com.antigravity.servicedashboard.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.TestPropertySource;

import com.antigravity.servicedashboard.entity.User;

@DataJpaTest
@TestPropertySource(locations = "classpath:application-test.properties")
public class UserRepositoryTest {

    @Autowired
    private UserRepository userRepository;

    @Test
    public void testSaveAndFind() {
        User user = new User();
        user.setUsername("testuser");
        user.setRole("ADMIN");
        user.setPreferences("{}");

        userRepository.save(user);

        Optional<User> found = userRepository.findById("testuser");
        assertTrue(found.isPresent());
        assertEquals("ADMIN", found.get().getRole());
    }

    @Test
    public void testDelete() {
        User user = new User();
        user.setUsername("deleteMe");
        userRepository.save(user);

        userRepository.deleteById("deleteMe");
        assertFalse(userRepository.findById("deleteMe").isPresent());
    }
}
