package com.antigravity.servicedashboard.controller;

import com.antigravity.servicedashboard.model.Notification;
import com.antigravity.servicedashboard.service.NotificationService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public List<Notification> getNotifications(@AuthenticationPrincipal Jwt jwt) {
        String username = jwt.getSubject();
        return notificationService.getPendingNotifications(username);
    }
}
