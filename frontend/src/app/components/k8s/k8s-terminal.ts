import { Component, ElementRef, Input, OnDestroy, AfterViewInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from '../../../environments/environment';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

@Component({
    selector: 'app-k8s-terminal',
    standalone: true,
    imports: [CommonModule],
    template: `<div #terminal class="terminal-container"></div>`,
    styles: [`
    .terminal-container {
      width: 100%;
      height: 400px;
      background: #000;
      padding: 10px;
    }
  `],
    encapsulation: ViewEncapsulation.None
})
export class K8sTerminalComponent implements AfterViewInit, OnDestroy {
    @Input() namespace = 'default';
    @Input() pod = '';
    @Input() container = '';
    @Input() command = '/bin/sh';

    @ViewChild('terminal') terminalDiv!: ElementRef;

    private term!: Terminal;
    private fitAddon!: FitAddon;
    private socket!: WebSocket;

    ngAfterViewInit() {
        this.term = new Terminal({
            cursorBlink: true,
            theme: {
                background: '#1a1b26',
                foreground: '#c0caf5'
            }
        });

        this.fitAddon = new FitAddon();
        this.term.loadAddon(this.fitAddon);

        this.term.open(this.terminalDiv.nativeElement);
        this.fitAddon.fit();

        this.connect();

        // Resize observer
        new ResizeObserver(() => this.fitAddon.fit()).observe(this.terminalDiv.nativeElement);
    }

    connect() {
        if (!this.pod) return;

        // Remove /api suffix from environment.apiUrl since WebSocket endpoint is at root
        const wsBase = environment.apiUrl.replace(/\/api$/, '').replace(/^http/, 'ws');
        const url = `${wsBase}/ws/k8s/exec?namespace=${this.namespace}&pod=${this.pod}&command=${this.command}`;

        this.socket = new WebSocket(url);

        this.socket.onopen = () => {
            this.term.write('\r\n\x1b[32mConnected to ' + this.pod + '\x1b[0m\r\n');
            this.term.focus();
        };

        this.socket.onmessage = (event) => {
            this.term.write(event.data);
        };

        this.socket.onclose = () => {
            this.term.write('\r\n\x1b[31mConnection closed\x1b[0m\r\n');
        };

        this.socket.onerror = (error) => {
            this.term.write('\r\n\x1b[31mConnection error\x1b[0m\r\n');
        };

        this.term.onData((data: string) => {
            if (this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(data);
            }
        });
    }

    ngOnDestroy() {
        if (this.socket) {
            this.socket.close();
        }
        if (this.term) {
            this.term.dispose();
        }
    }
}
