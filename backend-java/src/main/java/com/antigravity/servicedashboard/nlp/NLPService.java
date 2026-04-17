package com.antigravity.servicedashboard.nlp;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import opennlp.tools.namefind.NameFinderME;
import opennlp.tools.namefind.TokenNameFinderModel;
import opennlp.tools.postag.POSModel;
import opennlp.tools.postag.POSTaggerME;
import opennlp.tools.sentdetect.SentenceDetectorME;
import opennlp.tools.sentdetect.SentenceModel;
import opennlp.tools.tokenize.TokenizerME;
import opennlp.tools.tokenize.TokenizerModel;
import opennlp.tools.util.Span;

@Service
public class NLPService {

    private SentenceDetectorME sentenceDetector;
    private TokenizerME tokenizer;
    private NameFinderME personFinder;
    private NameFinderME locationFinder;
    private NameFinderME orgFinder;
    private POSTaggerME posTagger;

    @PostConstruct
    public void init() throws IOException {

        try (InputStream is = new ClassPathResource("models/en-sent.bin").getInputStream()) {
            sentenceDetector = new SentenceDetectorME(new SentenceModel(is));
        }
        try (InputStream is = new ClassPathResource("models/en-token.bin").getInputStream()) {
            tokenizer = new TokenizerME(new TokenizerModel(is));
        }
        try (InputStream is = new ClassPathResource("models/en-ner-person.bin").getInputStream()) {
            personFinder = new NameFinderME(new TokenNameFinderModel(is));
        }
        try (InputStream is = new ClassPathResource("models/en-ner-location.bin").getInputStream()) {
            locationFinder = new NameFinderME(new TokenNameFinderModel(is));
        }
        try (InputStream is = new ClassPathResource("models/en-ner-organization.bin").getInputStream()) {
            orgFinder = new NameFinderME(new TokenNameFinderModel(is));
        }
        try (InputStream is = new ClassPathResource("models/en-pos-maxent.bin").getInputStream()) {
            posTagger = new POSTaggerME(new POSModel(is));
        }
    }

    public NLPResult analyze(String text) {
        if (text == null || text.trim().isEmpty()) {
            return new NLPResult();
        }

        NLPResult result = new NLPResult();
        result.setOriginalText(text);


        String[] sentences = sentenceDetector.sentDetect(text);
        result.setSentences(Arrays.asList(sentences));

        List<NLPResult.SentenceAnalysis> sentenceAnalyses = new ArrayList<>();

        for (String sentence : sentences) {
            NLPResult.SentenceAnalysis analysis = new NLPResult.SentenceAnalysis();
            analysis.setText(sentence);


            String[] tokens = tokenizer.tokenize(sentence);
            analysis.setTokens(Arrays.asList(tokens));


            String[] tags = posTagger.tag(tokens);

            List<NLPResult.TokenTag> tokenTags = new ArrayList<>();
            for (int i = 0; i < tokens.length; i++) {
                tokenTags.add(new NLPResult.TokenTag(tokens[i], tags[i]));
            }
            analysis.setPosTags(tokenTags);


            List<NLPResult.Entity> entities = new ArrayList<>();
            entities.addAll(findEntities(personFinder, tokens, "Person"));
            entities.addAll(findEntities(locationFinder, tokens, "Location"));
            entities.addAll(findEntities(orgFinder, tokens, "Organization"));
            analysis.setEntities(entities);

            sentenceAnalyses.add(analysis);
        }

        result.setAnalysis(sentenceAnalyses);
        return result;
    }

    private List<NLPResult.Entity> findEntities(NameFinderME finder, String[] tokens, String type) {
        Span[] spans = finder.find(tokens);
        List<NLPResult.Entity> entities = new ArrayList<>();
        for (Span span : spans) {
            String entityText = String.join(" ", Arrays.copyOfRange(tokens, span.getStart(), span.getEnd()));
            entities.add(new NLPResult.Entity(entityText, type, span.getStart(), span.getEnd()));
        }
        finder.clearAdaptiveData();
        return entities;
    }


    public static class NLPResult {
        private String originalText;
        private List<String> sentences;
        private List<SentenceAnalysis> analysis;


        public String getOriginalText() {
            return originalText;
        }

        public void setOriginalText(String originalText) {
            this.originalText = originalText;
        }

        public List<String> getSentences() {
            return sentences;
        }

        public void setSentences(List<String> sentences) {
            this.sentences = sentences;
        }

        public List<SentenceAnalysis> getAnalysis() {
            return analysis;
        }

        public void setAnalysis(List<SentenceAnalysis> analysis) {
            this.analysis = analysis;
        }

        public static class SentenceAnalysis {
            private String text;
            private List<String> tokens;
            private List<TokenTag> posTags;
            private List<Entity> entities;


            public String getText() {
                return text;
            }

            public void setText(String text) {
                this.text = text;
            }

            public List<String> getTokens() {
                return tokens;
            }

            public void setTokens(List<String> tokens) {
                this.tokens = tokens;
            }

            public List<TokenTag> getPosTags() {
                return posTags;
            }

            public void setPosTags(List<TokenTag> posTags) {
                this.posTags = posTags;
            }

            public List<Entity> getEntities() {
                return entities;
            }

            public void setEntities(List<Entity> entities) {
                this.entities = entities;
            }
        }

        public static class TokenTag {
            private String token;
            private String tag;

            public TokenTag(String t, String tg) {
                this.token = t;
                this.tag = tg;
            }

            public String getToken() {
                return token;
            }

            public String getTag() {
                return tag;
            }
        }

        public static class Entity {
            private String text;
            private String type;
            private int start;
            private int end;

            public Entity(String t, String ty, int s, int e) {
                this.text = t;
                this.type = ty;
                this.start = s;
                this.end = e;
            }

            public String getText() {
                return text;
            }

            public String getType() {
                return type;
            }

            public int getStart() {
                return start;
            }

            public int getEnd() {
                return end;
            }
        }
    }
}
