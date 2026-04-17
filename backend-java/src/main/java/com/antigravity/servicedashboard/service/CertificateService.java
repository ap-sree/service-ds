package com.antigravity.servicedashboard.service;

import com.antigravity.servicedashboard.dto.CertificateDTO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.security.KeyStore;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;

import com.antigravity.servicedashboard.util.MessageUtils;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;

@Service
public class CertificateService {

    private static final Logger logger = LoggerFactory.getLogger(CertificateService.class);

    @Value("${spring.ssl.bundle.jks.server.truststore.location}")
    private String trustStoreLocation;

    @Value("${spring.ssl.bundle.jks.server.truststore.password}")
    private String trustStorePassword;

    public CertificateService() {
    }

    private String getFilePath() {
        if (trustStoreLocation.startsWith("file:")) {
            return trustStoreLocation.substring(5);
        }
        return trustStoreLocation;
    }

    private KeyStore loadKeyStore() throws Exception {
        KeyStore ks = KeyStore.getInstance("JKS");
        try (FileInputStream fis = new FileInputStream(getFilePath())) {
            ks.load(fis, trustStorePassword.toCharArray());
        }
        return ks;
    }

    private void saveKeyStore(KeyStore ks) throws Exception {
        try (FileOutputStream fos = new FileOutputStream(getFilePath())) {
            ks.store(fos, trustStorePassword.toCharArray());
        }
    }

    public List<CertificateDTO> listCertificates() {
        List<CertificateDTO> certs = new ArrayList<>();
        try {
            KeyStore ks = loadKeyStore();
            Enumeration<String> aliases = ks.aliases();
            while (aliases.hasMoreElements()) {
                String alias = aliases.nextElement();
                if (ks.isCertificateEntry(alias)) {
                    X509Certificate cert = (X509Certificate) ks.getCertificate(alias);
                    certs.add(new CertificateDTO(
                            alias,
                            cert.getSubjectX500Principal().getName(),
                            cert.getIssuerX500Principal().getName(),
                            cert.getNotBefore(),
                            cert.getNotAfter(),
                            cert.getSerialNumber().toString(16)));
                }
            }
        } catch (Exception e) {
            logger.error("Failed to list certificates", e);
            return Collections.emptyList();
        }
        return certs;
    }

    public void importCertificate(String alias, MultipartFile file) {
        try {
            CertificateFactory cf = CertificateFactory.getInstance("X.509");
            X509Certificate cert = (X509Certificate) cf.generateCertificate(file.getInputStream());

            KeyStore ks = loadKeyStore();
            ks.setCertificateEntry(alias, cert);
            saveKeyStore(ks);

        } catch (Exception e) {
            logger.error("Failed to import certificate: {}", alias, e);
            throw new RuntimeException(MessageUtils.get("error.cert.import", e.getMessage()), e);
        }
    }

    public void deleteCertificate(String alias) {
        try {
            KeyStore ks = loadKeyStore();
            if (ks.containsAlias(alias)) {
                ks.deleteEntry(alias);
                saveKeyStore(ks);
            }
        } catch (Exception e) {
            logger.error("Failed to delete certificate: {}", alias, e);
            throw new RuntimeException(MessageUtils.get("error.cert.delete", e.getMessage()), e);
        }
    }

}
