package com.antigravity.servicedashboard.controller;

import com.antigravity.servicedashboard.dto.CertificateDTO;
import com.antigravity.servicedashboard.service.CertificateService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/certificates")
public class CertificateController {

    private final CertificateService certificateService;

    public CertificateController(CertificateService certificateService) {
        this.certificateService = certificateService;
    }

    @GetMapping
    public ResponseEntity<List<CertificateDTO>> listCertificates() {
        return ResponseEntity.ok(certificateService.listCertificates());
    }

    @PostMapping
    public ResponseEntity<Void> importCertificate(
            @RequestParam("alias") String alias,
            @RequestParam("file") MultipartFile file) {

        if (alias == null || alias.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        try {
            certificateService.importCertificate(alias, file);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @DeleteMapping("/{alias}")
    public ResponseEntity<Void> deleteCertificate(@PathVariable String alias) {
        try {
            certificateService.deleteCertificate(alias);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }
}
