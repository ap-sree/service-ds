package com.antigravity.servicedashboard.controller;

import com.antigravity.servicedashboard.model.Notification;
import com.antigravity.servicedashboard.service.NotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    @Autowired
    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public List<Notification> getNotifications(@RequestParam(required = false) String user) {
        return notificationService.getPendingNotifications(user);
    }
}
