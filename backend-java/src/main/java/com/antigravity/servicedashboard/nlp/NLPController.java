package com.antigravity.servicedashboard.nlp;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/nlp")
public class NLPController {

    private final NLPService nlpService;

    public NLPController(NLPService nlpService) {
        this.nlpService = nlpService;
    }

    @PostMapping("/analyze")
    public NLPService.NLPResult analyze(@RequestBody TextRequest request) {
        return nlpService.analyze(request.getText());
    }

    public static class TextRequest {
        private String text;

        public String getText() {
            return text;
        }

        public void setText(String text) {
            this.text = text;
        }
    }
}
